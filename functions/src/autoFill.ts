import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getFirestore, FieldValue, Timestamp} from "firebase-admin/firestore";
import {defineSecret} from "firebase-functions/params";

const geoapifyKey = defineSecret("GEOAPIFY_API_KEY");

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SEARCH_RADIUS_M = 5000;
const WIKI_TIMEOUT_MS = 2000;
const MIN_RESULTS = 5;
const MAX_RESULTS = 7;

type AppEventType =
  | "Sightseeing" | "Museum" | "Restaurant" | "Cafe" | "Park"
  | "Zoo" | "Aquarium" | "Beach" | "Shopping" | "Bar";

interface DaySuggestion {
  name: string;
  eventType: AppEventType;
  description: string;
  location: string;
  lat: number;
  lng: number;
  googleMapsUrl: string;
  imageUrl: string | null;
  estimatedCost: number;
}

interface AutoFillRequest {
  tripId: string;
  lat: number;
  lng: number;
  locationName: string;
}

// Roles that can run auto-fill. Explorers can also auto-fill — their resulting events
// become suggestions on the client side via createEvent's permission-based mode resolver.
const ALLOWED_ROLES = new Set(["owner", "manager", "explorer"]);

// Geoapify category → app Event type. First-match wins when a place has multiple categories.
const CATEGORY_MAP: ReadonlyArray<[string, AppEventType]> = [
  ["entertainment.museum", "Museum"],
  ["entertainment.zoo", "Zoo"],
  ["entertainment.aquarium", "Aquarium"],
  ["catering.restaurant", "Restaurant"],
  ["catering.cafe", "Cafe"],
  ["catering.bar", "Bar"],
  ["leisure.park", "Park"],
  ["beach", "Beach"],
  ["commercial", "Shopping"],
  ["tourism.sights", "Sightseeing"],
  ["tourism.attraction", "Sightseeing"],
  ["tourism", "Sightseeing"],
];

const COST_BY_TYPE: Record<AppEventType, number> = {
  Museum: 20,
  Restaurant: 30,
  Cafe: 15,
  Park: 0,
  Beach: 0,
  Zoo: 25,
  Aquarium: 30,
  Sightseeing: 10,
  Shopping: 0,
  Bar: 25,
};

const GEOAPIFY_CATEGORIES = [
  "tourism.sights",
  "tourism.attraction",
  "entertainment.museum",
  "catering.restaurant",
  "catering.cafe",
  "leisure.park",
  "entertainment.zoo",
  "entertainment.aquarium",
  "beach",
].join(",");

interface GeoapifyFeature {
  properties: {
    name?: string;
    formatted?: string;
    address_line1?: string;
    address_line2?: string;
    lat: number;
    lon: number;
    categories?: string[];
    datasource?: {raw?: {wikipedia?: string}};
  };
}

const classifyEventType = (categories: string[] = []): AppEventType => {
  for (const [prefix, type] of CATEGORY_MAP) {
    if (categories.some((c) => c.startsWith(prefix))) return type;
  }
  return "Sightseeing";
};

const buildGoogleMapsUrl = (name: string, lat: number, lng: number): string => {
  const q = encodeURIComponent(`${name} @${lat},${lng}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
};

const fetchWithTimeout = async (url: string, ms: number): Promise<Response | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {signal: controller.signal});
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

// Queries Wikipedia's summary endpoint. Returns { thumbnail, extract } or nulls.
const fetchWikiInfo = async (
  name: string,
): Promise<{thumbnail: string | null; extract: string | null}> => {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
  const res = await fetchWithTimeout(url, WIKI_TIMEOUT_MS);
  if (!res || !res.ok) return {thumbnail: null, extract: null};
  try {
    const data = await res.json() as {thumbnail?: {source?: string}; extract?: string};
    return {
      thumbnail: data.thumbnail?.source ?? null,
      extract: data.extract ?? null,
    };
  } catch {
    return {thumbnail: null, extract: null};
  }
};

// Picks up to `max` features with category diversity (round-robin across buckets).
const diverseSelect = (features: GeoapifyFeature[], max: number): GeoapifyFeature[] => {
  const buckets = new Map<AppEventType, GeoapifyFeature[]>();
  for (const f of features) {
    const type = classifyEventType(f.properties.categories);
    if (!buckets.has(type)) buckets.set(type, []);
    buckets.get(type)!.push(f);
  }
  const picked: GeoapifyFeature[] = [];
  let added = true;
  while (added && picked.length < max) {
    added = false;
    for (const arr of buckets.values()) {
      if (picked.length >= max) break;
      const next = arr.shift();
      if (next) {
        picked.push(next);
        added = true;
      }
    }
  }
  return picked;
};

const featureToSuggestion = async (f: GeoapifyFeature): Promise<DaySuggestion | null> => {
  const p = f.properties;
  const name = p.name;
  if (!name) return null;
  const eventType = classifyEventType(p.categories);
  const location = p.formatted ?? p.address_line2 ?? p.address_line1 ?? "";
  const {thumbnail, extract} = await fetchWikiInfo(name);
  return {
    name,
    eventType,
    description: extract ?? `${eventType} near ${location.split(",")[0] || "this area"}.`,
    location,
    lat: p.lat,
    lng: p.lon,
    googleMapsUrl: buildGoogleMapsUrl(name, p.lat, p.lon),
    imageUrl: thumbnail,
    estimatedCost: COST_BY_TYPE[eventType],
  };
};

export const autoFillDay = onCall(
  {secrets: [geoapifyKey]},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const {tripId, lat, lng, locationName} = (request.data ?? {}) as AutoFillRequest;
    if (!tripId || typeof lat !== "number" || typeof lng !== "number" || !locationName) {
      throw new HttpsError("invalid-argument", "Missing tripId, lat, lng, or locationName.");
    }

    const db = getFirestore();
    const uid = request.auth.uid;

    // Permission guard — mirror invite function's pattern.
    const tripSnap = await db.doc(`trips/${tripId}`).get();
    if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found.");
    const tripData = tripSnap.data()!;
    const role = tripData.userId === uid
      ? "owner"
      : tripData.permissions?.[uid];
    if (!role || !ALLOWED_ROLES.has(role)) {
      throw new HttpsError("permission-denied", "You don't have permission to auto-fill this day.");
    }

    const locationKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const cacheRef = db.doc(`placeSuggestionsCache/${locationKey}`);
    const cacheSnap = await cacheRef.get();
    if (cacheSnap.exists) {
      const cache = cacheSnap.data()!;
      const expiresAt = cache.expiresAt as Timestamp | undefined;
      if (expiresAt && expiresAt.toMillis() > Date.now() && Array.isArray(cache.suggestions)) {
        return {suggestions: cache.suggestions as DaySuggestion[]};
      }
    }

    // Geoapify call.
    const apiKey = geoapifyKey.value();
    const geoUrl =
      "https://api.geoapify.com/v2/places" +
      `?categories=${GEOAPIFY_CATEGORIES}` +
      `&filter=circle:${lng},${lat},${SEARCH_RADIUS_M}` +
      "&limit=40" +
      `&apiKey=${apiKey}`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) {
      const body = await geoRes.text().catch(() => "(unreadable)");
      console.error(`Geoapify ${geoRes.status}: ${body}`);
      throw new HttpsError("internal", `Geoapify request failed (${geoRes.status}): ${body}`);
    }
    const geoJson = await geoRes.json() as {features?: GeoapifyFeature[]};
    const features = (geoJson.features ?? []).filter((f) => !!f.properties?.name);
    if (features.length < MIN_RESULTS) {
      throw new HttpsError(
        "failed-precondition",
        "Could not find enough places near this location. Try a larger city.",
      );
    }

    const picked = diverseSelect(features, MAX_RESULTS);
    const enriched = await Promise.all(picked.map(featureToSuggestion));
    const suggestions = enriched.filter((s): s is DaySuggestion => s !== null);
    if (suggestions.length < MIN_RESULTS) {
      throw new HttpsError("internal", "Failed to build enough suggestions.");
    }

    // Cache write — fire-and-forget.
    const now = Date.now();
    cacheRef
      .set({
        locationKey,
        locationName,
        coordinates: {lat, lng},
        suggestions,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(now + CACHE_TTL_MS),
      })
      .catch((err) => console.warn("Cache write failed:", err));

    return {suggestions};
  },
);

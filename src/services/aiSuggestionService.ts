import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { Event, EVENT_CATEGORY } from '../types/event';
import { findPlaceWithDetails } from './googleMapsService';

export interface AISuggestion {
  id: string;
  title: string;
  type: Event['type'];
  description: string;
  address: string | null;
  cost: number | null;
}

export interface TripLocation {
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

export interface AIMeta {
  suggestions: AISuggestion[];
  locations: TripLocation[];
  messageCount: number;
  updatedAt: number;
}

export interface SuggestionContext {
  tripId: string;
  tripName: string;
  totalUsers: number;
  budget: number | null;
  numDays: number;
  hasWeekend: boolean;
  hasWeekday: boolean;
  locations: TripLocation[];
}

export const MAX_AI_MESSAGES_PER_TRIP = 10;

export const GEMINI_MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
  { value: 'gemini-2.5-flash-lite', label: 'gemini-2.5-flash-lite' },
  { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro' },
] as const;

// gemini-2.5-flash supports the google_search grounding tool and structured
// JSON output. Lite is faster but less reliable with grounding; pro is slower.
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

const VALID_TYPES = Object.keys(EVENT_CATEGORY) as Event['type'][];

const suggestionsDocRef = (tripId: string) =>
  doc(db, 'trips', tripId, 'meta', 'aiSuggestions');

const EMPTY_META: AIMeta = {
  suggestions: [],
  locations: [],
  messageCount: 0,
  updatedAt: 0,
};

const normalizeMeta = (data: Partial<AIMeta> | undefined): AIMeta => ({
  suggestions: data?.suggestions ?? [],
  locations: data?.locations ?? [],
  messageCount: typeof data?.messageCount === 'number' ? data.messageCount : 0,
  updatedAt: typeof data?.updatedAt === 'number' ? data.updatedAt : 0,
});

export async function loadSavedSuggestions(tripId: string): Promise<AISuggestion[] | null> {
  const snap = await getDoc(suggestionsDocRef(tripId));
  if (!snap.exists()) return null;
  return (snap.data().suggestions as AISuggestion[]) ?? null;
}

export async function loadAIMeta(tripId: string): Promise<AIMeta> {
  const snap = await getDoc(suggestionsDocRef(tripId));
  if (!snap.exists()) return EMPTY_META;
  return normalizeMeta(snap.data() as Partial<AIMeta>);
}

export function subscribeToAIMeta(
  tripId: string,
  cb: (meta: AIMeta) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    suggestionsDocRef(tripId),
    (snap) => cb(snap.exists() ? normalizeMeta(snap.data() as Partial<AIMeta>) : EMPTY_META),
    (err) => onError?.(err),
  );
}

export async function saveSuggestions(tripId: string, suggestions: AISuggestion[]): Promise<void> {
  await setDoc(
    suggestionsDocRef(tripId),
    { suggestions, updatedAt: Date.now() },
    { merge: true },
  );
}

export async function saveLocations(tripId: string, locations: TripLocation[]): Promise<void> {
  await setDoc(
    suggestionsDocRef(tripId),
    { locations, updatedAt: Date.now() },
    { merge: true },
  );
}

export async function hasExistingEvents(tripId: string): Promise<boolean> {
  const q = query(collectionGroup(db, 'events'), where('tripId', '==', tripId), limit(1));
  const snap = await getDocs(q);
  return !snap.empty;
}

// Tries to resolve the trip name to a city via Google Places.
// Returns an empty array if the name doesn't identify a geographic place.
export async function detectTripLocations(
  tripName: string,
): Promise<TripLocation[]> {
  try {
    const place = await findPlaceWithDetails(tripName);
    if (place) {
      return [{ name: place.name, address: place.address, lat: place.lat, lng: place.lng }];
    }
  } catch { /* ignore */ }
  return [];
}

async function fetchExistingEventNames(tripId: string): Promise<string[]> {
  const q = query(collectionGroup(db, 'events'), where('tripId', '==', tripId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => (d.data() as { name?: string }).name ?? '')
    .filter(Boolean)
    .slice(0, 20);
}

// ---------------------------------------------------------------------------
// Prompt chip definitions
// ---------------------------------------------------------------------------

export type PromptKey =
  | 'top-things-to-do'
  | 'hidden-gems'
  | 'food-spots'
  | 'group-friendly'
  | 'weekend-nightlife'
  | 'budget-friendly'
  | 'family-friendly'
  | 'reddit-trending';

export interface PromptChip {
  key: PromptKey;
  label: string;
}

const cityFromLocations = (locations: TripLocation[]): string => {
  if (locations.length === 0) return 'this destination';
  const first = locations[0].name || locations[0].address;
  if (locations.length === 1) return first;
  return `${first} and ${locations.length - 1} more`;
};

export function buildPromptChips(
  ctx: Pick<SuggestionContext, 'totalUsers' | 'budget' | 'hasWeekend' | 'locations'>,
): PromptChip[] {
  const city = cityFromLocations(ctx.locations);
  const chips: PromptChip[] = [
    { key: 'top-things-to-do', label: `Top things to do in ${city}` },
    { key: 'hidden-gems', label: `Hidden gems in ${city}` },
    { key: 'food-spots', label: `Best food spots in ${city}` },
    { key: 'reddit-trending', label: 'Trending on Reddit & TripAdvisor' },
  ];

  if (ctx.totalUsers >= 3) {
    chips.push({ key: 'group-friendly', label: `Fun spots for ${ctx.totalUsers}+ people` });
  }
  if (ctx.hasWeekend) {
    chips.push({ key: 'weekend-nightlife', label: `Weekend nightlife in ${city}` });
  }
  if (ctx.budget && ctx.budget > 0) {
    const perPerson = Math.max(1, Math.round(ctx.budget / Math.max(1, ctx.totalUsers)));
    chips.push({ key: 'budget-friendly', label: `Budget picks under $${perPerson}/person` });
  }
  chips.push({ key: 'family-friendly', label: 'Family-friendly things to do' });

  return chips;
}

const PROMPT_INSTRUCTIONS: Record<PromptKey, string> = {
  'top-things-to-do':
    'Suggest the top must-do activities and attractions travelers consistently rave about.',
  'hidden-gems':
    'Suggest hidden gems and lesser-known spots that locals love but tourists often miss.',
  'food-spots':
    'Suggest the best food spots — a mix of iconic restaurants, casual eats, and standout cafes.',
  'group-friendly':
    'Suggest activities and venues that work well for a group of friends — bookable, social, and easy to coordinate.',
  'weekend-nightlife':
    'Suggest weekend nightlife — bars, clubs, live music, and late-night experiences.',
  'budget-friendly':
    'Suggest affordable activities and places that deliver great value without breaking the budget.',
  'family-friendly':
    'Suggest family-friendly activities suitable for a wide range of ages.',
  'reddit-trending':
    'Suggest places and activities that are currently trending on Reddit, Quora, and TripAdvisor — what travelers are raving about right now.',
};

// ---------------------------------------------------------------------------
// Gemini call
// ---------------------------------------------------------------------------

// Robust JSON-array extractor for grounded responses, which often interleave
// prose, citation markers like [1], and code fences. Strategy:
//   1. Try a direct parse.
//   2. Strip markdown fences and try again.
//   3. Scan for the first balanced top-level [...] block, respecting strings.
const extractJsonArray = (raw: string): unknown[] | null => {
  const tryParse = (s: string): unknown[] | null => {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  };

  let direct = tryParse(raw);
  if (direct) return direct;

  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  direct = tryParse(stripped);
  if (direct) return direct;

  // Balanced-bracket scan, ignoring brackets inside strings.
  for (let i = 0; i < stripped.length; i++) {
    if (stripped[i] !== '[') continue;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let j = i; j < stripped.length; j++) {
      const c = stripped[j];
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (c === '[') depth++;
      else if (c === ']') {
        depth--;
        if (depth === 0) {
          const candidate = stripped.slice(i, j + 1);
          const parsed = tryParse(candidate);
          if (parsed) return parsed;
          break;
        }
      }
    }
  }
  return null;
};

const buildPrompt = (ctx: SuggestionContext, key: PromptKey, existingNames: string[]): string => {
  const weekendStr =
    ctx.hasWeekend && ctx.hasWeekday
      ? 'mix of weekdays and weekends'
      : ctx.hasWeekend
        ? 'weekend trip'
        : 'weekday trip';

  const locationsStr =
    ctx.locations.length > 0
      ? ctx.locations.map((l) => l.name || l.address).join(', ')
      : 'an unspecified destination';

  const budgetStr = ctx.budget && ctx.budget > 0
    ? `\nGroup budget: $${ctx.budget} total ($${Math.round(ctx.budget / Math.max(1, ctx.totalUsers))}/person)`
    : '';

  const alreadyStr =
    existingNames.length > 0 ? existingNames.join(', ') : 'nothing yet';

  return `You are a travel planner for a trip called "${ctx.tripName}".
Destinations: ${locationsStr}
Travelers: ${ctx.totalUsers}
Days: ${ctx.numDays} (${weekendStr})${budgetStr}
Already on the itinerary: ${alreadyStr}

Task: ${PROMPT_INSTRUCTIONS[key]}

Use up-to-date information from Reddit, Quora, TripAdvisor, and other travel forums via the search tool. Prefer recent, well-reviewed places. Avoid duplicates of items already on the itinerary.

OUTPUT FORMAT — CRITICAL:
Respond with ONLY a single JSON array. No prose before or after. No markdown fences. No citation markers like [1], [2]. No source list. No commentary.

Return between 7 and 10 distinct items. Each item must be an object with EXACTLY these keys:
  "name":        string (specific place or activity)
  "type":        one of [${VALID_TYPES.join(', ')}]
  "description": single sentence, 20 words max — plain text only, no citations
  "address":     string (street address or city) or null
  "cost":        number (USD per person) or null

Example of the only acceptable output shape:
[{"name":"...","type":"Restaurant","description":"...","address":"...","cost":25}]`;
};

export async function fetchAISuggestions(
  ctx: SuggestionContext,
  promptKey: PromptKey,
  model: string = DEFAULT_GEMINI_MODEL,
): Promise<AISuggestion[]> {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!key) throw new Error('VITE_GEMINI_API_KEY is not set.');

  // Enforce per-trip cap before spending an API call.
  const meta = await loadAIMeta(ctx.tripId);
  if (meta.messageCount >= MAX_AI_MESSAGES_PER_TRIP) {
    throw new Error('LIMIT_REACHED');
  }

  const existingEventNames = await fetchExistingEventNames(ctx.tripId);
  const prompt = buildPrompt(ctx, promptKey, existingEventNames);

  // google_search grounding pulls from Reddit / Quora / TripAdvisor / etc.
  // Note: tools + responseSchema can't be combined in v1beta, so when grounding
  // we rely on the prompt's JSON instructions and parse defensively.
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.7,
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    if (res.status === 429 || res.status === 503) throw new Error('HIGH_USAGE');
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }

  const data = await res.json();

  const finishReason = data?.candidates?.[0]?.finishReason;
  if (finishReason === 'RECITATION' || !data?.candidates?.[0]?.content) {
    if (data?.promptFeedback?.blockReason) throw new Error('HIGH_USAGE');
  }

  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const rawText: string = parts.map((p: { text?: string }) => p.text ?? '').join('').trim();

  const extracted = extractJsonArray(rawText);
  if (!extracted) {
    throw new Error('Failed to parse Gemini response as JSON.');
  }
  const parsed = extracted as Array<{
    name?: string;
    type?: string;
    description?: string;
    address?: string | null;
    cost?: number | null;
  }>;

  const suggestions: AISuggestion[] = parsed.slice(0, 10).map((item, i) => ({
    id: `s${Date.now()}-${i}`,
    title: item.name ?? 'Unnamed suggestion',
    type: (VALID_TYPES.includes(item.type as Event['type'])
      ? (item.type as Event['type'])
      : 'None') as Event['type'],
    description: item.description ?? '',
    address: item.address ?? null,
    cost: typeof item.cost === 'number' ? item.cost : null,
  }));

  // Only burn a message slot once we've confirmed a usable response.
  await setDoc(
    suggestionsDocRef(ctx.tripId),
    {
      suggestions,
      messageCount: meta.messageCount + 1,
      updatedAt: Date.now(),
    },
    { merge: true },
  );

  return suggestions;
}

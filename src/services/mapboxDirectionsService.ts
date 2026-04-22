// Service for fetching route directions from the Mapbox Directions API.
// https://docs.mapbox.com/api/navigation/directions/

interface DirectionsRouteGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}

interface MapboxDirectionsRoute {
  geometry: DirectionsRouteGeometry;
  distance: number;
  duration: number;
}

interface MapboxDirectionsResponse {
  routes: MapboxDirectionsRoute[];
  code: string;
  message?: string;
}

export interface DirectionsResult {
  geometry: DirectionsRouteGeometry;
  distance: number; // meters
  duration: number; // seconds
}

export type DirectionsProfile = 'driving' | 'walking' | 'cycling';

/**
 * Fetches a route between two or more waypoints using the Mapbox Directions API.
 *
 * @param waypoints - Array of [longitude, latitude] pairs (2–25 waypoints).
 * @param profile   - Routing profile: 'driving', 'walking', or 'cycling'.
 * @param accessToken - Mapbox public access token.
 */
export const fetchDirections = async (
  waypoints: [number, number][],
  profile: DirectionsProfile = 'driving',
  accessToken: string,
): Promise<DirectionsResult> => {
  if (waypoints.length < 2) {
    throw new Error('At least 2 waypoints are required');
  }

  const coords = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}` +
    `?geometries=geojson&overview=full&access_token=${accessToken}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Directions request failed (HTTP ${response.status})`);
  }

  const data = (await response.json()) as MapboxDirectionsResponse;

  if (data.code !== 'Ok' || data.routes.length === 0) {
    throw new Error(data.message ?? 'No route found between the given locations');
  }

  const route = data.routes[0];
  return {
    geometry: route.geometry,
    distance: route.distance,
    duration: route.duration,
  };
};

declare global {
  interface Window {
    google?: any;
  }
}

let googleMapsPromise: Promise<any> | null = null;

export const loadGoogleMaps = async (): Promise<any> => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GOOGLE_MAPS_API_KEY is not defined');
  }

  if (window.google?.maps) {
    return window.google;
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-maps-api]');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.google?.maps) {
          resolve(window.google);
        } else {
          reject(new Error('Google Maps loaded but window.google is unavailable'));
        }
      });
      existingScript.addEventListener('error', () => {
        reject(new Error('Failed to load Google Maps script'));
      });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsApi = 'true';
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google);
      } else {
        reject(new Error('Google Maps loaded but window.google is unavailable'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
};

export const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  const google = await loadGoogleMaps();
  const service = new google.maps.places.PlacesService(document.createElement('div'));
  return new Promise((resolve) => {
    service.findPlaceFromQuery(
      { query: address, fields: ['geometry'] },
      (results: any[], status: string) => {
        if (status === 'OK' && results?.[0]?.geometry?.location) {
          const loc = results[0].geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng() });
        } else {
          resolve(null);
        }
      },
    );
  });
};

export interface PlaceDetails {
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

const GEOGRAPHIC_TYPES = new Set([
  'locality',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'sublocality',
  'natural_feature',
  'country',
  'colloquial_area',
  'political',
]);

export const findPlaceWithDetails = async (query: string): Promise<PlaceDetails | null> => {
  const google = await loadGoogleMaps();
  const service = new google.maps.places.PlacesService(document.createElement('div'));
  return new Promise((resolve) => {
    service.findPlaceFromQuery(
      { query, fields: ['name', 'formatted_address', 'geometry', 'types'] },
      (results: any[], status: string) => {
        if (status === 'OK' && results?.[0]) {
          const r = results[0];
          const types: string[] = r.types ?? [];
          if (!types.some((t) => GEOGRAPHIC_TYPES.has(t))) { resolve(null); return; }
          resolve({
            name: r.name ?? query,
            address: r.formatted_address ?? query,
            lat: r.geometry?.location ? r.geometry.location.lat() : null,
            lng: r.geometry?.location ? r.geometry.location.lng() : null,
          });
        } else {
          resolve(null);
        }
      },
    );
  });
};

// Geocodes an address via the REST API and returns city-level PlaceDetails.
// Uses fetch (not the JS callback Geocoder) for reliable async behavior.
// Returns null if no city-level component can be found.
export const getCityFromAddress = async (address: string): Promise<PlaceDetails | null> => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (!apiKey) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.[0]) return null;
  const r = data.results[0];
  const components: Array<{ long_name: string; short_name: string; types: string[] }> =
    r.address_components ?? [];
  const locality = components.find((c) => c.types.includes('locality'));
  const admin1 = components.find((c) => c.types.includes('administrative_area_level_1'));
  const country = components.find((c) => c.types.includes('country'));
  const cityName = locality?.long_name ?? admin1?.long_name;
  if (!cityName) return null;
  const cityAddress = [locality?.long_name, admin1?.short_name, country?.short_name]
    .filter(Boolean)
    .join(', ');
  const loc = r.geometry?.location;
  return {
    name: cityName,
    address: cityAddress,
    lat: typeof loc?.lat === 'number' ? loc.lat : null,
    lng: typeof loc?.lng === 'number' ? loc.lng : null,
  };
};

export const getPlacePredictions = async (input: string): Promise<string[]> => {
  const google = await loadGoogleMaps();
  const service = new google.maps.places.AutocompleteService();

  return new Promise((resolve) => {
    service.getPlacePredictions({ input, types: ['establishment'] }, (predictions: any[], status: string) => {
      if (status === 'OK' && Array.isArray(predictions)) {
        resolve(predictions.map(prediction => prediction.description));
      } else {
        resolve([]);
      }
    });
  });
};

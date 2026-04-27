import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

const initLoader = () => {
  setOptions({
    key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    v: 'weekly',
  });
};

export interface PlaceResult {
  name: string;
  address: string;
  lat: number | undefined;
  lng: number | undefined;
}

/**
 * Mounts a Google PlaceAutocompleteElement into `container` and wires up
 * input/select handlers. Returns a cleanup function that removes listeners
 * and clears the container.
 */
export async function initPlaceAutocomplete(
  container: HTMLElement,
  options: {
    initialValue?: string;
    onInput: (value: string) => void;
    onSelect: (place: PlaceResult) => void;
  },
): Promise<() => void> {
  initLoader();
  const { PlaceAutocompleteElement, Place } = (await importLibrary('places')) as any;

  const el = new PlaceAutocompleteElement();
  el.classList.add('form-input');
  el.style.display = 'block';
  el.style.width = '100%';
  el.style.color = '#374151';

  if (options.initialValue) el.value = options.initialValue;

  container.innerHTML = '';
  container.appendChild(el);

  const handleInput = (event: any) => {
    const rawValue = event?.target?.value;
    const next = typeof rawValue === 'string' ? rawValue : String(el.value ?? '');
    options.onInput(next);
  };

  const handleSelect = async (event: any) => {
    const placeId = event.placePrediction.placeId;
    const fullPlace = new Place({ id: placeId });
    await fullPlace.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });

    const placeLocation = fullPlace.location;
    const lat: number | undefined =
      typeof placeLocation?.lat === 'function' ? placeLocation.lat() : placeLocation?.lat;
    const lng: number | undefined =
      typeof placeLocation?.lng === 'function' ? placeLocation.lng() : placeLocation?.lng;

    const address = fullPlace.formattedAddress ?? '';
    el.value = address;

    options.onSelect({
      name: fullPlace.displayName ?? '',
      address,
      lat: typeof lat === 'number' ? lat : undefined,
      lng: typeof lng === 'number' ? lng : undefined,
    });
  };

  el.addEventListener('input', handleInput);
  el.addEventListener('gmp-select', handleSelect);

  return () => {
    el.removeEventListener('input', handleInput);
    el.removeEventListener('gmp-select', handleSelect);
    if (container.contains(el)) container.innerHTML = '';
  };
}

/**
 * Geocodes a free-text address string to lat/lng using the Maps JS Geocoding
 * library (same loader as initPlaceAutocomplete — no extra API key needed).
 * Returns null if the address cannot be resolved.
 */
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  initLoader();
  const { Geocoder } = (await importLibrary('geocoding')) as any;
  const geocoder = new Geocoder();
  try {
    const { results } = await geocoder.geocode({ address });
    if (!results?.length) return null;
    const loc = results[0].geometry.location;
    const lat: number =
      typeof loc.lat === 'function' ? loc.lat() : loc.lat;
    const lng: number =
      typeof loc.lng === 'function' ? loc.lng() : loc.lng;
    return { lat, lng };
  } catch {
    return null;
  }
}

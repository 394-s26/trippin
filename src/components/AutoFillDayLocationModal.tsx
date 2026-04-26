import { useEffect, useRef, useState } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { SparkleIcon } from '../services/svgIcons';
import { createPortal } from 'react-dom';

export interface ResolvedLocation {
  name: string;
  lat: number;
  lng: number;
}

interface AutoFillDayLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSelected: (location: ResolvedLocation) => void;
}

const AutoFillDayLocationModal = ({
  isOpen,
  onClose,
  onLocationSelected,
}: AutoFillDayLocationModalProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    const init = async () => {
      setOptions({
        key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        v: 'weekly',
      });

      try {
        const { PlaceAutocompleteElement } = (await importLibrary('places')) as any;
        if (!isMounted || !containerRef.current) return;

        const el = new PlaceAutocompleteElement({
          includedPrimaryTypes: ['(cities)'],
        });
        el.classList.add('form-input');
        el.style.display = 'block';
        el.style.width = '100%';
        // Force light-mode rendering inside the shadow DOM so text stays black
        // regardless of the OS/browser dark-mode setting.
        el.style.colorScheme = 'light';

        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(el);

        const handleSelect = async (event: any) => {
          try {
            const placeId = event.placePrediction.placeId;
            const { Place } = (await importLibrary('places')) as any;
            const place = new Place({ id: placeId });
            await place.fetchFields({
              fields: ['displayName', 'formattedAddress', 'location'],
            });

            const loc = place.location;
            const lat = typeof loc?.lat === 'function' ? loc.lat() : loc?.lat;
            const lng = typeof loc?.lng === 'function' ? loc.lng() : loc?.lng;
            if (typeof lat !== 'number' || typeof lng !== 'number') {
              setError('Could not read coordinates for this place. Try another.');
              return;
            }
            onLocationSelected({
              name: place.formattedAddress || place.displayName || 'Selected place',
              lat,
              lng,
            });
          } catch (err) {
            console.error('Place selection failed:', err);
            setError('Could not resolve that place.');
          }
        };

        el.addEventListener('gmp-select', handleSelect);
      } catch (err) {
        console.error('Failed to load Google Maps:', err);
        setError('Could not load the location picker. Check your connection.');
      }
    };

    init();

    return () => {
      isMounted = false;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [isOpen, onLocationSelected]);

  if (!isOpen) return null;

  return createPortal(
    <div className="overlay-center" onClick={onClose}>
      <div
        className="overlay-panel overlay-panel--md rounded-2xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-2 text-indigo-600">
          <SparkleIcon size={20} />
          <span className="font-semibold">Auto-fill day</span>
        </div>
        <h2 className="text-xl font-bold mb-1">Where are you going?</h2>
        <p className="text-gray-600 text-sm mb-4">
          Pick a city and we'll suggest places to add to this day.
        </p>

        {/* color-scheme: light forces shadow DOM to render text in light mode regardless of OS dark mode */}
        <div ref={containerRef} style={{ colorScheme: 'light' }} />

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full text-gray-500 font-semibold hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
    ,document.body
  );
};

export default AutoFillDayLocationModal;

import { useEffect, useState } from 'react';
import { DaySuggestion } from '../types/suggestion';
import { Event } from '../types/event';
import { Day } from '../types/day';
import { fetchDaySuggestions } from '../services/autoFillService';
import { createEvent } from '../services/firestoreEventsService';
import { EVENT_TYPE_ICONS } from '../services/eventSvgIcons';
import { SparkleIcon } from '../services/svgIcons';

interface AutoFillDaySuggestionsModalProps {
  isOpen: boolean;
  day: Day | null;
  tripId: string;
  uid: string;
  location: { name: string; lat: number; lng: number } | null;
  onClose: () => void;
  onCompleted: () => void;
  onBack?: () => void;
}

const dayAtMidnight = (dayDate: Date): Date => {
  const d = new Date(dayDate);
  d.setHours(0, 0, 0, 0);
  return d;
};

const AutoFillDaySuggestionsModal = ({
  isOpen,
  day,
  tripId,
  uid,
  location,
  onClose,
  onCompleted,
  onBack,
}: AutoFillDaySuggestionsModalProps) => {
  const [suggestions, setSuggestions] = useState<DaySuggestion[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !location || !tripId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const results = await fetchDaySuggestions({
          tripId,
          lat: location.lat,
          lng: location.lng,
          locationName: location.name,
        });
        if (cancelled) return;
        setSuggestions(results);
        setSelected(results.map(() => false));
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Something went wrong.';
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, location, tripId]);

  if (!isOpen) return null;

  const toggleSelected = (idx: number) => {
    setSelected((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const selectedCount = selected.filter(Boolean).length;
  const canSubmit = selectedCount > 0 && !submitting && !!day;

  const handleSubmit = async () => {
    if (!canSubmit || !day) return;
    setSubmitting(true);
    setError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const chosen = suggestions.filter((_, i) => selected[i]);

      const dayStart = dayAtMidnight(day.date);
      const newEvents: Omit<Event, 'id'>[] = chosen.map((suggestion) => ({
        tripId,
        dayId: day.id,
        type: suggestion.eventType,
        name: suggestion.name,
        location: suggestion.location,
        lat: suggestion.lat,
        lng: suggestion.lng,
        imageUrl: suggestion.imageUrl,
        cost: null,
        startDate: dayStart,
        endDate: dayStart,
        allDay: true,
        timezone,
      }) as Omit<Event, 'id'>);

      await Promise.all(newEvents.map((e) => createEvent(uid, e)));
      onCompleted();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add events.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="overlay-center" onClick={onClose}>
      <div
        className="overlay-panel overlay-panel--md rounded-2xl p-6 shadow-xl max-h-[calc(80vh-80px)] flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="absolute top-4 right-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            Change location
          </button>
        )}
        <div className="flex items-center gap-2 mb-1 text-indigo-600">
          <SparkleIcon size={20} />
          <span className="font-semibold">Auto-fill day</span>
        </div>
        <h2 className="text-xl font-bold mb-1">
          Suggestions {location ? `near ${location.name.split(',')[0]}` : ''}
        </h2>
        <p className="text-gray-600 text-sm mb-4">
          Tap a card to add it to your day.
        </p>

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {loading && (
            <div className="py-10 text-center text-gray-500">Finding great places…</div>
          )}

          {!loading && error && (
            <div className="py-4 text-red-600 text-sm">{error}</div>
          )}

          {!loading && !error && suggestions.length === 0 && (
            <div className="py-10 text-center text-gray-500">
              No suggestions found. Try another city.
            </div>
          )}

          {!loading && !error && suggestions.map((s, idx) => {
            const isSelected = !!selected[idx];
            const IconComp = EVENT_TYPE_ICONS[s.eventType];
            return (
              <div
                key={`${s.name}-${idx}`}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => toggleSelected(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSelected(idx);
                  }
                }}
                className={`flex gap-4 p-3 -mx-1 rounded-lg border-b border-gray-100 cursor-pointer transition-colors ${
                  isSelected ? 'bg-indigo-50/60' : 'hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  tabIndex={-1}
                  aria-hidden="true"
                  className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-indigo-600 pointer-events-none"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {IconComp && (
                      <span className="text-gray-500">
                        <IconComp size={16} />
                      </span>
                    )}
                    <h3
                      className={`font-bold text-gray-900 ${isSelected ? '' : 'truncate'}`}
                    >
                      {s.name}
                    </h3>
                  </div>
                  <p
                    className={`text-sm text-gray-600 mt-1 ${isSelected ? '' : 'line-clamp-2'}`}
                  >
                    {s.description}
                  </p>
                  {s.location && (
                    <p
                      className={`text-xs text-gray-400 mt-1 ${isSelected ? '' : 'truncate'}`}
                    >
                      {s.location}
                    </p>
                  )}

                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                      isSelected ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="pt-3 text-sm">
                        <a
                          href={s.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View on Maps
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-36 h-24 shrink-0 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                  {s.imageUrl ? (
                    <img
                      src={s.imageUrl}
                      alt={s.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    IconComp && (
                      <span className="text-gray-400">
                        <IconComp size={36} />
                      </span>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full text-gray-600 font-semibold hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-full bg-primary text-white font-semibold hover:bg-primary-light disabled:opacity-50"
          >
            {submitting
              ? 'Adding…'
              : selectedCount > 0
                ? `Add ${selectedCount} to day`
                : 'Select places'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoFillDaySuggestionsModal;

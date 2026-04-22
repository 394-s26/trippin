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
}

interface RowState {
  selected: boolean;
  startTime: string;
  endTime: string;
  cost: string;
}

const emptyRow = (cost: number): RowState => ({
  selected: false,
  startTime: '',
  endTime: '',
  cost: String(cost),
});

// Combines a day's calendar date with an "HH:MM" time string into a Date.
const combineDateAndTime = (dayDate: Date, timeStr: string): Date => {
  const [hh, mm] = timeStr.split(':').map(Number);
  const d = new Date(dayDate);
  d.setHours(hh, mm, 0, 0);
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
}: AutoFillDaySuggestionsModalProps) => {
  const [suggestions, setSuggestions] = useState<DaySuggestion[]>([]);
  const [rows, setRows] = useState<RowState[]>([]);
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
        setRows(results.map((s) => emptyRow(s.estimatedCost)));
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

  const updateRow = (idx: number, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const selectedCount = rows.filter((r) => r.selected).length;
  const allSelectedHaveTimes = rows.every(
    (r) => !r.selected || (r.startTime && r.endTime && r.endTime > r.startTime),
  );
  const canSubmit = selectedCount > 0 && allSelectedHaveTimes && !submitting && !!day;

  const handleSubmit = async () => {
    if (!canSubmit || !day) return;
    setSubmitting(true);
    setError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const chosen = suggestions
        .map((s, i) => ({ suggestion: s, row: rows[i] }))
        .filter((x) => x.row.selected);

      const newEvents: Omit<Event, 'id'>[] = chosen.map(({ suggestion, row }) => {
        const costNum = parseFloat(row.cost);
        return {
          tripId,
          dayId: day.id,
          type: suggestion.eventType,
          name: suggestion.name,
          location: suggestion.location,
          lat: suggestion.lat,
          lng: suggestion.lng,
          imageUrl: suggestion.imageUrl,
          cost: isNaN(costNum) ? 0 : costNum,
          startDate: combineDateAndTime(day.date, row.startTime),
          endDate: combineDateAndTime(day.date, row.endTime),
          timezone,
        } as Omit<Event, 'id'>;
      });

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
        className="overlay-panel overlay-panel--md rounded-2xl p-6 shadow-xl max-h-[calc(80vh-80px)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1 text-indigo-600">
          <SparkleIcon size={20} />
          <span className="font-semibold">Auto-fill day</span>
        </div>
        <h2 className="text-xl font-bold mb-1">
          Suggestions {location ? `near ${location.name.split(',')[0]}` : ''}
        </h2>
        <p className="text-gray-600 text-sm mb-4">
          Pick the places you'd like to add. Set a start and end time for each.
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
            const row = rows[idx];
            const IconComp = EVENT_TYPE_ICONS[s.eventType];
            return (
              <div
                key={`${s.name}-${idx}`}
                className={`flex gap-4 py-4 border-b border-gray-100 ${
                  row.selected ? 'bg-indigo-50/40' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={(e) => updateRow(idx, { selected: e.target.checked })}
                  aria-label={`Select ${s.name}`}
                  className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-indigo-600"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {IconComp && (
                      <span className="text-gray-500">
                        <IconComp size={16} />
                      </span>
                    )}
                    <h3 className="font-bold text-gray-900 truncate">{s.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 mt-1">{s.description}</p>
                  {s.location && (
                    <p className="text-xs text-gray-400 mt-1 truncate">{s.location}</p>
                  )}

                  {row.selected && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                      <label className="flex items-center gap-1">
                        <span className="text-gray-500">Start</span>
                        <input
                          type="time"
                          value={row.startTime}
                          onChange={(e) => updateRow(idx, { startTime: e.target.value })}
                          className="border border-gray-200 rounded px-2 py-1"
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        <span className="text-gray-500">End</span>
                        <input
                          type="time"
                          value={row.endTime}
                          onChange={(e) => updateRow(idx, { endTime: e.target.value })}
                          className="border border-gray-200 rounded px-2 py-1"
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        <span className="text-gray-500">$</span>
                        <input
                          type="number"
                          min="0"
                          value={row.cost}
                          onChange={(e) => updateRow(idx, { cost: e.target.value })}
                          className="border border-gray-200 rounded px-2 py-1 w-20"
                        />
                      </label>
                      <a
                        href={s.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline"
                      >
                        View on Maps
                      </a>
                    </div>
                  )}
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

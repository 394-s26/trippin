import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Event } from '../../types/event';
import { Day } from '../../types/day';
import { Trip } from '../../types/trip';
import { createEvent } from '../../services/firestoreEventsService';
import { XIcon, PlusIcon } from '../../services/svgIcons';
import { fetchAISuggestions, loadSavedSuggestions, saveSuggestions, AISuggestion } from '../../services/aiSuggestionService';
import { geocodeAddress } from '../../services/googleMapsService';
import TimeSelect from '../TimeSelect';
import './AISuggestionsCard.css';

interface AISuggestionsCardProps {
  tripId: string;
  currentUid: string | null;
  days: Omit<Day, 'events'>[];
  canCreateEvent: boolean;
  canProposeEvent: boolean;
  trip: Trip;
  tripUserCount: number;
}

const HIGH_USAGE_MESSAGE = 'Gemini is experiencing high usage right now. Please try again in a moment.';

const formatDayOption = (d: Date): string =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const AISuggestionsCard = ({
  tripId,
  currentUid,
  days,
  canCreateEvent,
  canProposeEvent,
  trip,
  tripUserCount,
}: AISuggestionsCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState<AISuggestion | null>(null);
  const [dayId, setDayId] = useState('');
  const [time, setTime] = useState('10:00');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  const sortedDays = useMemo(
    () => [...days].sort((a, b) => a.date.getTime() - b.date.getTime()),
    [days],
  );

  // Load cached suggestions from Firestore on mount
  useEffect(() => {
    loadSavedSuggestions(tripId)
      .then((saved) => { if (saved) setSuggestions(saved); })
      .catch(() => {/* silently ignore — user can still generate */})
      .finally(() => setInitialLoading(false));
  }, [tripId]);

  const buildContext = () => {
    const hasWeekend = sortedDays.some((d) => d.date.getDay() === 0 || d.date.getDay() === 6);
    const hasWeekday = sortedDays.some((d) => d.date.getDay() >= 1 && d.date.getDay() <= 5);
    return {
      tripId,
      tripName: trip.name,
      totalUsers: tripUserCount,
      budget: trip.budget > 0 ? trip.budget : null,
      numDays: sortedDays.length,
      hasWeekend,
      hasWeekday,
    };
  };

  const generate = async () => {
    setGenerating(true);
    setSuggestionsError(null);
    try {
      const result = await fetchAISuggestions(buildContext());
      setSuggestions(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      
      setSuggestionsError(msg === 'HIGH_USAGE' ? HIGH_USAGE_MESSAGE : `Error: ${msg}` );  // 'Could not load suggestions.'
    } finally {
      setGenerating(false);
    }
  };

  const canAct = canCreateEvent || canProposeEvent;
  const suggestOnly = !canCreateEvent && canProposeEvent;
  const actionLabel = suggestOnly ? 'Suggest' : 'Add';
  const pickerTitle = suggestOnly ? 'Suggest for the itinerary' : 'Add to itinerary';
  const confirmLabel = suggestOnly ? 'Suggest event' : 'Add to itinerary';
  const hasSuggestions = suggestions.length > 0;

  const openPicker = (e: React.MouseEvent, s: AISuggestion) => {
    e.stopPropagation();
    if (!canAct) return;
    setError(null);
    setAdding(s);
    setDayId(sortedDays[0]?.id ?? '');
    setTime('10:00');
  };

  const handleAdd = async () => {
    if (!currentUid || !adding || !dayId) return;
    const day = sortedDays.find((d) => d.id === dayId);
    if (!day) {
      setError('Pick a day first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const [hh, mm] = time.split(':').map((p) => parseInt(p, 10) || 0);
      const startDate = new Date(day.date);
      startDate.setHours(hh, mm, 0, 0);
      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 1);

      const coords = adding.address ? await geocodeAddress(adding.address).catch(() => null) : null;

      await createEvent(currentUid, {
        tripId,
        dayId,
        type: adding.type,
        name: adding.title,
        startDate,
        endDate,
        allDay: false,
        cost: adding.cost || null,
        location: adding.address ?? undefined,
        ...(coords ?? {}),
        suggestion: null,
        isSuggestion: suggestOnly,
      } as Omit<Event, 'id'> & { isSuggestion?: boolean });
      const addedId = adding.id;
      const updated = suggestions.filter((s) => s.id !== addedId);
      setSuggestions(updated);
      saveSuggestions(tripId, updated).catch(() => {});
      setAdding(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCardClick = () => { if (!expanded) setExpanded(true); };
  const handleCollapse = (e: React.MouseEvent) => { e.stopPropagation(); setExpanded(false); };

  const renderSkeletonRows = (count: number) =>
    Array.from({ length: count }).map((_, i) => (
      <div key={i} className="misc-ai-preview-row misc-ai-skeleton-row">
        <div className="misc-ai-preview-dot misc-ai-skeleton-dot" />
        <div className="misc-ai-skeleton-line" />
      </div>
    ));

  const renderCollapsed = () => (
    <>
      <div className="misc-card-header">
        <span className="misc-card-title">AI SUGGESTIONS</span>
        <span className="misc-card-count">
          {initialLoading ? '…' : hasSuggestions ? suggestions.length : '0'}
        </span>
      </div>
      <div className="misc-ai-preview">
        {initialLoading
          ? renderSkeletonRows(4)
          : hasSuggestions
            ? suggestions.slice(0, 4).map((s) => (
                <div key={s.id} className="misc-ai-preview-row">
                  <div className="misc-ai-preview-dot" />
                  <span className="misc-ai-preview-title">{s.title}</span>
                </div>
              ))
            : <span className="misc-ai-preview-hint misc-ai-preview-hint--empty">No suggestions yet</span>}
      </div>
      <span className="misc-ai-preview-hint">Tap for more</span>
    </>
  );

  const renderExpanded = () => (
    <>
      <div className="misc-card-header">
        <span className="misc-card-title">AI SUGGESTIONS</span>
        <div className="misc-ai-header-actions">
          {hasSuggestions && (
            <button
              type="button"
              className="misc-ai-refresh-btn"
              onClick={(e) => { e.stopPropagation(); generate(); }}
              disabled={generating}
              aria-label="Refresh suggestions"
            >
              {generating ? '…' : '↺'}
            </button>
          )}
          <button
            type="button"
            className="misc-modal-close"
            onClick={handleCollapse}
            aria-label="Collapse suggestions"
          >
            <XIcon size={18} />
          </button>
        </div>
      </div>

      <p className="misc-ai-blurb">
        {suggestOnly
          ? 'Ideas based on your trip — suggest one for the group to vote on.'
          : 'Ideas based on your trip location and current itinerary.'}
      </p>

      {generating && (
        <div className="misc-ai-loading">
          <div className="misc-ai-spinner" />
          <span>Getting suggestions…</span>
        </div>
      )}

      {!generating && suggestionsError && (
        <div className="misc-ai-error-block">
          <span>{suggestionsError}</span>
          <button type="button" className="misc-ai-retry-btn" onClick={generate}>
            Try again
          </button>
        </div>
      )}

      {!generating && !suggestionsError && hasSuggestions && (
        <ul className="misc-ai-list misc-ai-list--inline">
          {suggestions.map((s) => (
            <li key={s.id} className="misc-ai-item">
              <div className="misc-ai-item-body">
                <div className="misc-ai-item-header">
                  <span className="misc-ai-item-type">{s.type}</span>
                  <h4 className="misc-ai-item-title">{s.title}</h4>
                </div>
                <p className="misc-ai-item-desc">{s.description}</p>
                {s.address && <p className="misc-ai-item-address">{s.address}</p>}
                {s.cost != null && <p className="misc-ai-item-cost">~${s.cost}/person</p>}
              </div>
              <button
                type="button"
                className="misc-ai-add-btn"
                onClick={(e) => openPicker(e, s)}
                disabled={!canAct || !currentUid || sortedDays.length === 0}
                aria-label={actionLabel}
              >
                <PlusIcon size={16} />
                <span>{actionLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!generating && !suggestionsError && !hasSuggestions && !initialLoading && (
        <div className="misc-ai-empty">
          <p className="misc-ai-empty-text">No suggestions yet. Generate some based on your trip.</p>
          <button
            type="button"
            className="misc-ai-generate-btn"
            onClick={generate}
          >
            Generate suggestions
          </button>
        </div>
      )}

      {sortedDays.length === 0 && (
        <div className="misc-ai-inline-error">
          Add some trip days first, then these can be inserted.
        </div>
      )}
      {!canAct && (
        <div className="misc-ai-inline-error">
          You don't have permission to add or suggest events for this trip.
        </div>
      )}
    </>
  );

  return (
    <>
      <div
        className={`misc-card misc-card--ai${expanded ? ' misc-card--ai-expanded' : ''}`}
        role={!expanded ? 'button' : undefined}
        tabIndex={!expanded ? 0 : undefined}
        aria-label={!expanded ? 'Open AI suggestions' : undefined}
        onClick={!expanded ? handleCardClick : undefined}
        onKeyDown={
          !expanded
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setExpanded(true);
                }
              }
            : undefined
        }
      >
        {expanded ? renderExpanded() : renderCollapsed()}
      </div>

      {adding && createPortal(
        <div className="overlay-bottom misc-ai-picker-layer">
          <div className="overlay-scrim" onClick={() => (!submitting ? setAdding(null) : undefined)} />
          <div className="overlay-panel overlay-panel--sm rounded-t-2xl p-5 pb-8 flex flex-col gap-3 animate-slide-up misc-modal">
            <div className="misc-modal-header">
              <h2 className="misc-modal-title">{pickerTitle}</h2>
              <button
                type="button"
                className="misc-modal-close"
                onClick={() => setAdding(null)}
                aria-label="Cancel"
                disabled={submitting}
              >
                <XIcon size={20} />
              </button>
            </div>
            <div className="misc-ai-picker-title">{adding.title}</div>
            <label className="misc-ai-picker-label">
              <span>Day</span>
              <select
                className="misc-ai-picker-input"
                value={dayId}
                onChange={(e) => setDayId(e.target.value)}
                disabled={submitting}
              >
                {sortedDays.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatDayOption(d.date)}
                    {d.label ? ` — ${d.label}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="misc-ai-picker-label">
              <span>Start time</span>
              <TimeSelect
                value={time}
                onChange={setTime}
                disabled={submitting}
                ariaLabel="Start time"
              />
            </label>
            {error && <div className="misc-photos-error">{error}</div>}
            <button
              type="button"
              className="global-btn default-btn"
              onClick={handleAdd}
              disabled={submitting || !dayId}
            >
              {submitting ? (suggestOnly ? 'Suggesting…' : 'Adding…') : confirmLabel}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default AISuggestionsCard;

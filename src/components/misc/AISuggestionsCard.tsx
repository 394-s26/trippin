import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Event } from '../../types/event';
import { Day } from '../../types/day';
import { createEvent } from '../../services/firestoreEventsService';
import { XIcon, PlusIcon, CheckIcon } from '../../services/svgIcons';
import './AISuggestionsCard.css';

interface AISuggestionsCardProps {
  tripId: string;
  currentUid: string | null;
  days: Omit<Day, 'events'>[];
  canCreateEvent: boolean;
  canProposeEvent: boolean;
}

interface AISuggestion {
  id: string;
  title: string;
  type: Event['type'];
  description: string;
}

// Placeholder suggestions. Once an AI backend exists, swap this constant for
// data keyed off trip location + already-added events.
const PLACEHOLDER_SUGGESTIONS: AISuggestion[] = [
  {
    id: 's1',
    title: 'Visit the local history museum',
    type: 'Museum',
    description: 'A classic first-day orientation — get context on the area before exploring.',
  },
  {
    id: 's2',
    title: 'Sunset viewpoint hike',
    type: 'Hiking',
    description: 'A short trail popular at golden hour. 1–2 hours round trip.',
  },
  {
    id: 's3',
    title: 'Try the highest-rated local restaurant',
    type: 'Restaurant',
    description: 'Book ahead. Reliably great reviews for authentic regional cuisine.',
  },
  {
    id: 's4',
    title: 'Morning coffee & pastry spot',
    type: 'Cafe',
    description: 'Start a day right with a neighborhood-favorite café.',
  },
  {
    id: 's5',
    title: 'City walking tour',
    type: 'Tour',
    description: 'Free or paid walking tours cover the main landmarks in 2–3 hours.',
  },
];

const formatDayOption = (d: Date): string =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const AISuggestionsCard = ({
  tripId,
  currentUid,
  days,
  canCreateEvent,
  canProposeEvent,
}: AISuggestionsCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState<AISuggestion | null>(null);
  const [dayId, setDayId] = useState('');
  const [time, setTime] = useState('10:00');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedState, setAddedState] = useState<{ id: string; mode: 'added' | 'suggested' } | null>(null);

  const sortedDays = useMemo(
    () => [...days].sort((a, b) => a.date.getTime() - b.date.getTime()),
    [days],
  );

  const canAct = canCreateEvent || canProposeEvent;
  const suggestOnly = !canCreateEvent && canProposeEvent;
  const actionLabel = suggestOnly ? 'Suggest' : 'Add';
  const pickerTitle = suggestOnly ? 'Suggest for the itinerary' : 'Add to itinerary';
  const confirmLabel = suggestOnly ? 'Suggest event' : 'Add to itinerary';

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

      await createEvent(currentUid, {
        tripId,
        dayId,
        type: adding.type,
        name: adding.title,
        startDate,
        endDate,
        allDay: false,
        cost: null,
        suggestion: null,
        isSuggestion: suggestOnly,
      } as Omit<Event, 'id'> & { isSuggestion?: boolean });
      const addedId = adding.id;
      const mode: 'added' | 'suggested' = suggestOnly ? 'suggested' : 'added';
      setAddedState({ id: addedId, mode });
      setAdding(null);
      setTimeout(() => {
        setAddedState((curr) => (curr?.id === addedId ? null : curr));
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCardClick = () => {
    if (!expanded) setExpanded(true);
  };

  const handleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(false);
  };

  const renderCollapsed = () => (
    <>
      <div className="misc-card-header">
        <span className="misc-card-title">AI</span>
        <span className="misc-card-count">{PLACEHOLDER_SUGGESTIONS.length}</span>
      </div>
      <div className="misc-ai-preview">
        {PLACEHOLDER_SUGGESTIONS.slice(0, 4).map((s) => (
          <div key={s.id} className="misc-ai-preview-row">
            <div className="misc-ai-preview-dot" />
            <span className="misc-ai-preview-title">{s.title}</span>
          </div>
        ))}
      </div>
      <span className="misc-ai-preview-hint">Tap for more</span>
    </>
  );

  const renderExpanded = () => (
    <>
      <div className="misc-card-header">
        <span className="misc-card-title">AI</span>
        <button
          type="button"
          className="misc-modal-close"
          onClick={handleCollapse}
          aria-label="Collapse suggestions"
        >
          <XIcon size={18} />
        </button>
      </div>
      <p className="misc-ai-blurb">
        {suggestOnly
          ? 'Ideas based on your trip — suggest one for the group to vote on.'
          : 'Ideas based on your trip location and current itinerary.'}
      </p>
      <ul className="misc-ai-list misc-ai-list--inline">
        {PLACEHOLDER_SUGGESTIONS.map((s) => {
          const isAdded = addedState?.id === s.id;
          return (
            <li key={s.id} className="misc-ai-item">
              <div className="misc-ai-item-body">
                <div className="misc-ai-item-header">
                  <span className="misc-ai-item-type">{s.type}</span>
                  <h4 className="misc-ai-item-title">{s.title}</h4>
                </div>
                <p className="misc-ai-item-desc">{s.description}</p>
              </div>
              <button
                type="button"
                className="misc-ai-add-btn"
                onClick={(e) => openPicker(e, s)}
                disabled={!canAct || !currentUid || sortedDays.length === 0}
                aria-label={actionLabel}
              >
                {isAdded ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
                <span>
                  {isAdded
                    ? addedState?.mode === 'suggested' ? 'Suggested' : 'Added'
                    : actionLabel}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
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
              <input
                type="time"
                className="misc-ai-picker-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={submitting}
              />
            </label>
            {error && <div className="misc-photos-error">{error}</div>}
            <button
              type="button"
              className="misc-ai-confirm-btn"
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

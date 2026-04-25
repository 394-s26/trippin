import EventCard from './EventCard';
import { PlusIcon } from '../services/svgIcons';
import { sliceEventForDay } from '../utilities/eventOverlapsDay';
import { Day } from '../types/day';
import { AppUser } from '../types/auth';
import { UserSelection } from '../hooks/useSessionSelections';
import { Event, SuggestionVote } from '../types/event';
import './ItineraryList.css';

interface ItineraryListProps {
  days: Day[];
  onAddEvent: (day: Day) => void;
  onSelectEvent?: (eventId: string) => void;
  selectedEventIds?: string[];
  allSelections?: UserSelection[];
  currentUserId?: string;
  tripUsers?: AppUser[];
  totalTripUsers?: number;
  canAddEvent?: boolean;
  addEventLabel?: string;
  onVoteSuggestion?: (event: Event, vote: SuggestionVote) => void;
  canApproveSuggestion?: boolean;
  onApproveSuggestion?: (event: Event) => void;
  onDeleteSuggestion?: (event: Event) => void;
  onDismissConflict?: (event: Event) => void;
}

const ItineraryList = ({
  days,
  onAddEvent,
  onSelectEvent,
  selectedEventIds = [],
  allSelections = [],
  currentUserId,
  tripUsers = [],
  totalTripUsers = 0,
  canAddEvent = false,
  addEventLabel = 'Event',
  onVoteSuggestion,
  canApproveSuggestion = false,
  onApproveSuggestion,
  onDeleteSuggestion,
  onDismissConflict,
}: ItineraryListProps) => {
  const eventNameById = new Map<string, string>();
  days.forEach((day) => {
    day.events.forEach((event) => {
      if (!eventNameById.has(event.id)) {
        eventNameById.set(event.id, event.name);
      }
    });
  });

  return (
    <div className="itinerary-list">
      {days.map((day, index) => (
        <div key={day.id} className="day-section">
          <div className="day-header">
            <span className="day-number">{index + 1}</span>
            <div className="day-label-wrapper">
              <span className="day-label-text">{day.label}</span>
            </div>
            <div className="day-actions">
              {canAddEvent && (
                <button
                  className="day-add-event-btn"
                  onClick={e => { e.stopPropagation(); onAddEvent(day); }}
                  aria-label="Add event"
                >
                  <PlusIcon size={14} />
                  {addEventLabel}
                </button>
              )}
            </div>
          </div>

          <div className="day-events">
            <div className="day-timeline" />
            {day.events.length > 0 ? (
              day.events.map(event => {
                const slice = sliceEventForDay(event, day);
                return (
                  <EventCard
                    key={`${event.id}-${day.id}`}
                    event={event}
                    daySlice={slice ?? undefined}
                    onSelect={() => onSelectEvent?.(event.id)}
                    isSelected={selectedEventIds.includes(event.id)}
                    allSelections={allSelections}
                    currentUserId={currentUserId}
                    tripUsers={tripUsers}
                    totalTripUsers={totalTripUsers}
                    conflictWithEventName={(event.conflictEventIds?.[0] && eventNameById.get(event.conflictEventIds[0])) || null}
                    onVoteSuggestion={onVoteSuggestion}
                    canApproveSuggestion={canApproveSuggestion}
                    onApproveSuggestion={onApproveSuggestion}
                    onDeleteSuggestion={onDeleteSuggestion}
                    onDismissConflict={onDismissConflict}
                  />
                );
              })
            ) : (
              <p className="day-no-events">No events yet.</p>
            )}
          </div>
        </div>
      ))}

      {days.length === 0 && (
        <div className="empty-trip-hint">
          <p className="empty-trip-text">Your awesome trip is looking empty...</p>
          <span className="empty-trip-caret">&#8964;</span>
        </div>
      )}
    </div>
  );
};

export default ItineraryList;

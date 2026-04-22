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
}

const ItineraryList = ({
  days,
  onAddEvent,
  onSelectEvent,
  selectedEventIds = [],
  allSelections = [],
  currentUserId,
  tripUsers,
  canAddEvent = false,
}: ItineraryListProps) => {
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
                  Add Event
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
                    allSelections={allSelections.filter(
                      s => s.selectedIds.includes(event.id) && s.uid !== currentUserId
                    )}
                    currentUserId={currentUserId}
                    tripUsers={tripUsers}
                    totalTripUsers={totalTripUsers}
                    onVoteSuggestion={onVoteSuggestion}
                    canApproveSuggestion={canApproveSuggestion}
                    onApproveSuggestion={onApproveSuggestion}
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

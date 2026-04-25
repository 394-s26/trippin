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
                  {addEventLabel}
                </button>
              )}
            </div>
          </div>

          <div className="day-events">
            <div className="day-timeline" />
            {day.events.length > 0 ? (() => {
                const slices = day.events.map(e => sliceEventForDay(e, day));
                const allDayEvents = day.events.filter((_, i) => slices[i]?.isAllDay);
                const timedEvents = day.events.filter((_, i) => !slices[i]?.isAllDay);
                const timedSlices = slices.filter(s => !s?.isAllDay);

                return (
                  <>
                    {allDayEvents.length > 0 && (
                      <div className="all-day-section">
                        <span className="all-day-section-label">All Day</span>
                        {allDayEvents.map((event) => {
                          const slice = slices[day.events.indexOf(event)];
                          return (
                            <div key={`${event.id}-${day.id}`} className="event-card-row">
                              <EventCard
                                event={event}
                                daySlice={slice ?? undefined}
                                onSelect={() => onSelectEvent?.(event.id)}
                                isSelected={selectedEventIds.includes(event.id)}
                                allSelections={allSelections}
                                currentUserId={currentUserId}
                                tripUsers={tripUsers}
                                totalTripUsers={totalTripUsers}
                                onVoteSuggestion={onVoteSuggestion}
                                canApproveSuggestion={canApproveSuggestion}
                                onApproveSuggestion={onApproveSuggestion}
                                onDeleteSuggestion={onDeleteSuggestion}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {timedEvents.map((event, eventIndex) => {
                      const currentSlice = timedSlices[eventIndex];
                      const prevSlice = timedSlices[eventIndex - 1];
                      const gapMs =
                        !!prevSlice && !!currentSlice
                          ? currentSlice.sliceStart.getTime() - prevSlice.sliceEnd.getTime()
                          : 0;
                      const gapLevel =
                        gapMs >= 3 * 60 * 60 * 1000 ? 3
                        : gapMs >= 2 * 60 * 60 * 1000 ? 2
                        : gapMs >= 1 * 60 * 60 * 1000 ? 1
                        : 0;

                      return (
                        <div
                          key={`${event.id}-${day.id}`}
                          className={`event-card-row${gapLevel > 0 ? ` event-card-row--large-gap--${gapLevel}` : ''}`}
                        >
                          <EventCard
                            event={event}
                            daySlice={currentSlice ?? undefined}
                            onSelect={() => onSelectEvent?.(event.id)}
                            isSelected={selectedEventIds.includes(event.id)}
                            allSelections={allSelections}
                            currentUserId={currentUserId}
                            tripUsers={tripUsers}
                            totalTripUsers={totalTripUsers}
                            onVoteSuggestion={onVoteSuggestion}
                            canApproveSuggestion={canApproveSuggestion}
                            onApproveSuggestion={onApproveSuggestion}
                            onDeleteSuggestion={onDeleteSuggestion}
                          />
                        </div>
                      );
                    })}
                  </>
                );
              })()
              : <p className="day-no-events">No events yet.</p>
            }
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

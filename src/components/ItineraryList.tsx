import EventCard from './EventCard';
import { PlusIcon, SparkleIcon } from '../services/svgIcons';
import { sliceEventForDay } from '../utilities/eventOverlapsDay';
import { Day } from '../types/day';
import { AppUser } from '../types/auth';
import { UserSelection } from '../hooks/useSessionSelections';
import { Event, SuggestionVote } from '../types/event';
import './ItineraryList.css';

interface ItineraryListProps {
  days: Day[];
  onAddDay?: () => void;
  onAddEvent: (day: Day) => void;
  onAutoFillDay?: (day: Day) => void;
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

const ORDINAL_SUFFIXES = ['th', 'st', 'nd', 'rd'];
const getOrdinal = (n: number) => {
  const v = n % 100;
  return n + (ORDINAL_SUFFIXES[(v - 20) % 10] ?? ORDINAL_SUFFIXES[v] ?? ORDINAL_SUFFIXES[0]);
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ItineraryList = ({
  days,
  onAddDay: _onAddDay,
  onAddEvent,
  onAutoFillDay,
  onSelectEvent,
  selectedEventIds = [],
  allSelections = [],
  currentUserId,
  tripUsers = [],
  totalTripUsers = 0,
  canAddEvent = false,
  addEventLabel: _addEventLabel = 'Event',
  onVoteSuggestion,
  canApproveSuggestion = false,
  onApproveSuggestion,
  onDeleteSuggestion,
}: ItineraryListProps) => {
  return (
    <div className="itinerary-list">
      {days.map((day, index) => {
        const monthDay = `${MONTH_NAMES[day.date.getMonth()]} ${getOrdinal(day.date.getDate())}`;
        const weekday = WEEKDAY_NAMES[day.date.getDay()];
        return (
          <section key={day.id} className="day-section">
            <div className="day-header">
              <div className="day-date-box">
                <span className="day-date-monthday">{monthDay}</span>
                <span className="day-date-weekday">{weekday}</span>
              </div>

              <div className="day-label-wrapper">
                <div className="day-actions">
                  {onAutoFillDay && (
                    <button
                      onClick={() => onAutoFillDay(day)}
                      aria-label={`Auto-fill day ${index + 1}`}
                      className="day-auto-fill-btn"
                    >
                      <SparkleIcon size={14} />
                      Auto-fill day
                    </button>
                  )}
                  {canAddEvent && (
                    <button
                      onClick={() => onAddEvent?.(day)}
                      aria-label={`Add event to day ${index + 1}`}
                      className="day-add-event-btn"
                    >
                      <PlusIcon size={14} />
                      Event
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="day-events">
              <div className="day-timeline" />
              {day.events.length > 0 ? (() => {
                  const deletedTargetIds = new Set(
                    day.events
                      .filter(e => e.suggestion?.type === 'delete' && e.suggestion.targetEventId)
                      .map(e => e.suggestion!.targetEventId as string)
                  );
                  const visibleEvents = day.events.filter(e => !deletedTargetIds.has(e.id));
                  const slices = visibleEvents.map(e => sliceEventForDay(e, day));
                  const allDayEvents = visibleEvents.filter((_, i) => slices[i]?.isAllDay);
                  const timedEvents = visibleEvents.filter((_, i) => !slices[i]?.isAllDay);
                  const timedSlices = slices.filter(s => !s?.isAllDay);

                  return (
                    <>
                      {allDayEvents.length > 0 && (
                        <div className="all-day-section">
                          <span className="all-day-section-label">All Day</span>
                          {allDayEvents.map((event) => {
                            const slice = slices[visibleEvents.indexOf(event)];
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
          </section>
        );
      })}

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

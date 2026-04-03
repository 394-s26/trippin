import { useState } from 'react';
import EventCard from './EventCard';
import { PencilIcon, CheckIcon, PlusIcon, TrashIcon } from '../services/svgIcons';
import { Day } from '../types/day';
import './ItineraryList.css';

interface ItineraryListProps {
  days: Day[];
  onAddDay: () => void;
  onUpdateDayLabel: (dayId: string, label: string) => void;
  onDeleteDay: (dayId: string) => void;
  onAddEvent?: (day: Day) => void;
  onDeleteEvent?: (tripId: string, dayId: string, eventId: string) => void;
}

const ItineraryList = ({ days, onAddDay, onUpdateDayLabel, onDeleteDay, onAddEvent, onDeleteEvent }: ItineraryListProps) => {
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startEdit = (day: Day) => {
    setEditingDay(day.id);
    setEditValue(day.label);
  };

  const commitEdit = (dayId: string) => {
    if (editValue.trim()) {
      onUpdateDayLabel(dayId, editValue.trim());
    }
    setEditingDay(null);
  };

  return (
    <div className="itinerary-list">
      {days.map((day, index) => {
        const isEditing = editingDay === day.id;
        const isConfirmingDelete = confirmDeleteId === day.id;
        const dayEvents = day.events;

        return (
          <section
            key={day.id}
            className={`day-section ${isEditing ? 'day-section-editing' : ''}`}
          >
            <div className="day-header">
              <span className="day-number">
                {index + 1}
              </span>

              <div className="day-label-wrapper">
                {isEditing ? (
                  <>
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(day.id); }}
                      className="day-label-input"
                    />
                    <button
                      onClick={() => commitEdit(day.id)}
                      aria-label="Confirm day label"
                      className="day-confirm-btn"
                    >
                      <CheckIcon size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="day-label-text">
                      {day.label}
                    </span>

                    {/* Right-aligned action buttons */}
                    <div className="day-actions">
                      <button
                        onClick={() => onAddEvent?.(day)}
                        aria-label={`Add event to day ${index + 1}`}
                        className="day-add-event-btn"
                      >
                        <PlusIcon size={14} />
                        Event
                      </button>
                      <button
                        onClick={() => startEdit(day)}
                        aria-label={`Edit label for day ${index + 1}`}
                        className="day-edit-btn"
                      >
                        <PencilIcon size={20} />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(day.id)}
                        aria-label={`Delete day ${index + 1}`}
                        className="day-delete-btn"
                      >
                        <TrashIcon size={20} />
                      </button>

                      {/* Delete confirmation popover */}
                      {isConfirmingDelete && (
                        <div className="delete-popover">
                          <p className="delete-popover-text">
                            Delete Day {index + 1} and all its events?
                          </p>
                          <div className="delete-popover-actions">
                            <button
                              onClick={() => {
                                onDeleteDay(day.id);
                                setConfirmDeleteId(null);
                              }}
                              className="delete-confirm-btn"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="delete-cancel-btn"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="day-events">
              <div className="day-timeline" />
              {dayEvents.length > 0 ? (
                dayEvents.map((event) => (
                  <EventCard key={event.id} event={event} onEdit={() => {}} onDelete={() => onDeleteEvent?.(event.tripId, event.dayId, event.id)} />
                ))
              ) : (
                <p className="day-no-events">No events yet.</p>
              )}
            </div>
          </section>
        );
      })}

      {/* Empty state hint */}
      {days.length === 0 && (
        <div className="empty-trip-hint">
          <p className="empty-trip-text">Your awesome trip is looking empty...</p>
          <span className="empty-trip-caret">&#8964;</span>
        </div>
      )}

      {/* Add Day button */}
      <button
        onClick={onAddDay}
        className="add-day-btn"
      >
        <PlusIcon size={18} />
        Add Day
      </button>
    </div>
  );
};

export default ItineraryList;

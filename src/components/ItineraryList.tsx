import { useState, useEffect, useRef } from 'react';
import EventCard from './EventCard';
import { PencilIcon, CheckIcon, PlusIcon, TrashIcon, GearIcon } from '../services/svgIcons';
import { sliceEventForDay } from '../utilities/eventOverlapsDay';
import { Day } from '../types/day';
import { AppUser } from '../types/auth';
import { UserSelection } from '../hooks/useSessionSelections';
import './ItineraryList.css';

interface ItineraryListProps {
  days: Day[];
  onAddDay: () => void;
  onUpdateDayLabel: (dayId: string, label: string) => void;
  onDeleteDay: (dayId: string) => void;
  onAddEvent?: (day: Day) => void;
  selectedEventIds?: string[];
  onSelectEvent?: (eventId: string) => void;
  allSelections?: UserSelection[];
  currentUserId?: string;
  tripUsers?: AppUser[];
  canAddEvent?: boolean;
  canAddDay?: boolean;
  canEditDay?: boolean;
  canDeleteDay?: boolean;
}

const ItineraryList = ({ days, onAddDay, onUpdateDayLabel, onDeleteDay, onAddEvent, selectedEventIds = [], onSelectEvent, allSelections = [], currentUserId, tripUsers = [], canAddEvent = false, canAddDay = false, canEditDay = false, canDeleteDay = false }: ItineraryListProps) => {
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [openMenuDayId, setOpenMenuDayId] = useState<string | null>(null);
  const menuRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  useEffect(() => {
    if (!openMenuDayId) return;
    const handler = (e: MouseEvent) => {
      const node = menuRefs.current.get(openMenuDayId);
      if (node && !node.contains(e.target as Node)) setOpenMenuDayId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuDayId]);

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
                      {(canEditDay || canDeleteDay) && (
                        <div
                          className="day-menu-wrapper"
                          ref={(el) => { menuRefs.current.set(day.id, el); }}
                        >
                          <button
                            onClick={() => setOpenMenuDayId(openMenuDayId === day.id ? null : day.id)}
                            aria-label={`Day ${index + 1} options`}
                            aria-expanded={openMenuDayId === day.id}
                            aria-haspopup="menu"
                            className={`day-gear-btn${openMenuDayId === day.id ? ' day-gear-btn--open' : ''}`}
                          >
                            <GearIcon size={20} />
                          </button>

                          {openMenuDayId === day.id && (
                            <div className="day-menu" role="menu">
                              {canEditDay && (
                                <button
                                  role="menuitem"
                                  onClick={() => { setOpenMenuDayId(null); startEdit(day); }}
                                  className="day-menu-item"
                                >
                                  <PencilIcon size={16} />
                                  <span>Rename</span>
                                </button>
                              )}
                              {canDeleteDay && (
                                <button
                                  role="menuitem"
                                  onClick={() => { setOpenMenuDayId(null); setConfirmDeleteId(day.id); }}
                                  className="day-menu-item day-menu-item--danger"
                                >
                                  <TrashIcon size={16} />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

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
                  <EventCard
                    key={event.id}
                    event={event}
                    daySlice={sliceEventForDay(event, day) ?? undefined}
                    onSelect={() => onSelectEvent?.(event.id)}
                    isSelected={selectedEventIds.includes(event.id)}
                    allSelections={allSelections}
                    currentUserId={currentUserId}
                    tripUsers={tripUsers}
                  />
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
      {canAddDay && (
        <button
          onClick={onAddDay}
          className="add-day-btn"
        >
          <PlusIcon size={18} />
          Add Day
        </button>
      )}
    </div>
  );
};

export default ItineraryList;

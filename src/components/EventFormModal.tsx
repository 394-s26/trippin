import { useState, useRef, useEffect } from 'react';
import { Event } from '../types/event';
import { AppUser } from '../types/auth';
import { UserIcon } from '../services/svgIcons';
import UserAvatar from './UserAvatar';
import './EventFormModal.css';

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  // tripId and dayId are added by the caller; the form only collects user-facing fields.
  onSubmit: (event: Omit<Event, 'id' | 'tripId' | 'dayId'>) => void;
  // When provided, the date is fixed to this day and only time is collected.
  dayDate?: Date;
  // All members of the trip (owner + shared) for assigning paidBy.
  tripUsers?: AppUser[];
}

const EVENT_TYPES: Event['type'][] = ['Activity', 'Hotel', 'Restaurant', 'Food'];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
];

const EventFormModal = ({ isOpen, onClose, onSubmit, dayDate, tripUsers }: EventFormModalProps) => {
  const [type, setType] = useState<Event['type']>('Activity');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [dateValue, setDateValue] = useState('');
  const [timezone, setTimezone] = useState('America/Chicago');
  const [cost, setCost] = useState('');
  const [paidBy, setPaidBy] = useState<string>('');
  const [paidByOpen, setPaidByOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!paidByOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPaidByOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [paidByOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    let eventDate: Date;
    if (dayDate) {
      const [hours, minutes] = dateValue.split(':').map(Number);
      eventDate = new Date(dayDate);
      eventDate.setHours(hours, minutes, 0, 0);
    } else {
      eventDate = new Date(dateValue);
    }
    onSubmit({
      type,
      name,
      location: location || undefined,
      date: eventDate,
      timezone,
      cost: cost !== '' ? parseFloat(cost) : null,
      paidBy: paidBy || null,
    });
    // Reset form
    setType('Activity');
    setName('');
    setLocation('');
    setDateValue('');
    setTimezone('America/Chicago');
    setCost('');
    setPaidBy('');
    setPaidByOpen(false);
    onClose();
  };

  return (
    <div className="overlay-bottom">
      <div className="overlay-scrim" onClick={onClose} />
      <div className="overlay-panel overlay-panel--lg rounded-t-2xl p-6 pb-10 max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="event-modal-header">
          <h2 className="event-modal-title">New Event</h2>
          <button
            onClick={onClose}
            className="event-modal-close-btn"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="event-modal-form">
          {/* Type */}
          <div>
            <label htmlFor="event-type" className="form-label">Type</label>
            <select
              id="event-type"
              value={type}
              onChange={(e) => setType(e.target.value as Event['type'])}
              className="form-input"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="event-name" className="form-label">Name</label>
            <input
              id="event-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hike to Old Faithful"
              className="form-input"
              required
            />
          </div>

          {/* Location */}
          <div>
            <label htmlFor="event-location" className="form-label">Location</label>
            <input
              id="event-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Main Geyser Loop"
              className="form-input"
            />
          </div>

          {/* Date / Time */}
          <div>
            <label htmlFor="event-date" className="form-label">
              {dayDate ? 'Time' : 'Date & Time'}
            </label>
            <input
              id="event-date"
              type={dayDate ? 'time' : 'datetime-local'}
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="form-input"
              required
            />
          </div>

          {/* Timezone */}
          <div>
            <label htmlFor="event-timezone" className="form-label">Timezone</label>
            <select
              id="event-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="form-input"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          {/* Cost & Paid By */}
          <div className="cost-paidby-row">
            <div className="cost-paidby-cost">
              <label htmlFor="event-cost" className="form-label">
                Cost <span className="normal-case font-normal text-gray-400">(optional)</span>
              </label>
              <div className="cost-input-wrapper">
                <span className="cost-input-prefix">$</span>
                <input
                  id="event-cost"
                  type="number"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0.00"
                  min={0}
                  step="0.01"
                  className="cost-input"
                />
              </div>
            </div>

            {tripUsers && tripUsers.length > 0 && (
              <div className="cost-paidby-who">
                <label className="form-label">Paid By</label>
                <div className="paidby-dropdown" ref={dropdownRef}>
                  <button
                    type="button"
                    className="paidby-trigger"
                    onClick={() => setPaidByOpen(o => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={paidByOpen}
                  >
                    {paidBy
                      ? <UserAvatar user={tripUsers.find(u => u.uid === paidBy) ?? null} size="sm" />
                      : <span className="paidby-unknown-icon"><UserIcon size={14} /></span>
                    }
                    <span className="paidby-trigger-label">
                      {paidBy
                        ? (() => { const u = tripUsers.find(x => x.uid === paidBy); return u ? u.firstName : ''; })()
                        : 'Unknown'
                      }
                    </span>
                    <svg className={`paidby-chevron${paidByOpen ? ' paidby-chevron--open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {paidByOpen && (
                    <div className="paidby-options" role="listbox">
                      <button
                        type="button"
                        role="option"
                        aria-selected={!paidBy}
                        className={`paidby-option${!paidBy ? ' paidby-option--selected' : ''}`}
                        onClick={() => { setPaidBy(''); setPaidByOpen(false); }}
                      >
                        <span className="paidby-unknown-icon"><UserIcon size={14} /></span>
                        <span>Unknown</span>
                      </button>
                      {tripUsers.map(u => (
                        <button
                          key={u.uid}
                          type="button"
                          role="option"
                          aria-selected={paidBy === u.uid}
                          className={`paidby-option${paidBy === u.uid ? ' paidby-option--selected' : ''}`}
                          onClick={() => { setPaidBy(u.uid); setPaidByOpen(false); }}
                        >
                          <UserAvatar user={u} size="sm" />
                          <span>{u.firstName} {u.lastName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button type="submit" className="event-modal-submit-btn">
            Add Event
          </button>
        </form>
      </div>
    </div>
  );
};

export default EventFormModal;

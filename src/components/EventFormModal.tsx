import { useState, useRef, useEffect } from 'react';
import { Event, EVENT_CATEGORY, EventCategory } from '../types/event';
import { AppUser } from '../types/auth';
import { EVENT_TYPE_ICONS } from '../services/eventSvgIcons';
import { UserIcon } from '../services/svgIcons';
import UserAvatar from './UserAvatar';
import './EventFormModal.css';

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: Omit<Event, 'id' | 'tripId' | 'dayId'>) => void;
  dayDate?: Date;
  tripUsers?: AppUser[];
  currentUserId?: string;
  tripBudget?: number;
  tripSpent?: number;
}

const ALL_EVENT_TYPES = Object.keys(EVENT_CATEGORY) as Event['type'][];
const CATEGORIES: EventCategory[] = ['Transportation', 'Lodging', 'Activity', 'Attraction', 'Food & Drink'];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
];

const EventFormModal = ({ isOpen, onClose, onSubmit, dayDate, tripUsers, currentUserId, tripBudget, tripSpent }: EventFormModalProps) => {
  const [category, setCategory] = useState<EventCategory>('Activity');
  const [type, setType] = useState<Event['type']>('Hiking');
  const [name, setName] = useState('');

  const filteredTypes = ALL_EVENT_TYPES.filter(t => EVENT_CATEGORY[t] === category);

  const handleCategoryChange = (cat: EventCategory) => {
    setCategory(cat);
    const typesInCat = ALL_EVENT_TYPES.filter(t => EVENT_CATEGORY[t] === cat);
    if (typesInCat.length > 0 && !typesInCat.includes(type)) {
      setType(typesInCat[0]);
    }
  };
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [dateValue, setDateValue] = useState('');
  const [timezone, setTimezone] = useState('America/Chicago');
  const [cost, setCost] = useState('');
  const [paidBy, setPaidBy] = useState<string>(currentUserId ?? '');
  const [paidByOpen, setPaidByOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && currentUserId) {
      setPaidBy(currentUserId);
    }
  }, [isOpen, currentUserId]);

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

  const costNum = cost !== '' ? parseFloat(cost) : 0;
  const wouldExceedBudget = tripBudget != null && tripBudget > 0 && tripSpent != null && (tripSpent + costNum) > tripBudget;

  const handleSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault();

    let eventDate: Date;
    let eventEndDate: Date | null = null;

    if (dayDate) {
      eventDate = new Date(dayDate);
      if (startTime) {
        const [h, m] = startTime.split(':').map(Number);
        eventDate.setHours(h, m, 0, 0);
      }
      if (endTime) {
        eventEndDate = new Date(dayDate);
        const [h, m] = endTime.split(':').map(Number);
        eventEndDate.setHours(h, m, 0, 0);
      }
    } else {
      eventDate = dateValue ? new Date(dateValue) : new Date();
    }

    onSubmit({
      type,
      name,
      location: location || undefined,
      startDate: eventDate,
      endDate: eventEndDate,
      timezone,
      cost: cost !== '' ? parseFloat(cost) : null,
      paidBy: paidBy || null,
    });

    setCategory('Lodging');
    setType('Hotel');
    setName('');
    setLocation('');
    setStartTime('');
    setEndTime('');
    setDateValue('');
    setTimezone('America/Chicago');
    setCost('');
    setPaidBy(currentUserId ?? '');
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
          {/* Category tabs */}
          <div>
            <label className="form-label">Category</label>
            <div className="category-tabs">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`category-tab${category === cat ? ' category-tab--active' : ''}`}
                  onClick={() => handleCategoryChange(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Type icon grid */}
          <div>
            <label className="form-label">Type</label>
            <div className="type-grid">
              {filteredTypes.map((t) => {
                const IconComponent = EVENT_TYPE_ICONS[t];
                return (
                  <button
                    key={t}
                    type="button"
                    className={`type-grid-item${type === t ? ' type-grid-item--selected' : ''}`}
                    onClick={() => setType(t)}
                  >
                    <span className="type-grid-icon">
                      {IconComponent && <IconComponent size={28} />}
                    </span>
                    <span className="type-grid-label">{t}</span>
                  </button>
                );
              })}
            </div>
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

          {/* Start / End Time */}
          {dayDate ? (
            <div className="time-row">
              <div className="time-field">
                <label htmlFor="event-start-time" className="form-label">Start Time</label>
                <input
                  id="event-start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="time-field">
                <label htmlFor="event-end-time" className="form-label">End Time</label>
                <input
                  id="event-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="event-date" className="form-label">Date & Time</label>
              <input
                id="event-date"
                type="datetime-local"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="form-input"
              />
            </div>
          )}

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
                {tripSpent != null && (
                  <span
                    className="cost-input-total"
                    style={{ color: wouldExceedBudget ? 'var(--color-amber-600)' : 'var(--color-gray-400)' }}
                  >
                    Trip Total: ${(tripSpent + costNum).toFixed(2)}
                  </span>
                )}
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

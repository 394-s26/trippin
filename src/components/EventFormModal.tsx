import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Event, EVENT_CATEGORY, EventCategory } from '../types/event';
import { AppUser } from '../types/auth';
import { EVENT_TYPE_ICONS } from '../services/eventSvgIcons';
import { UserIcon } from '../services/svgIcons';
import UserAvatar from './UserAvatar';
import { toDate } from '../utilities/timestamps';
import './EventFormModal.css';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

export type EventFormMode = 'create' | 'edit' | 'readonly';

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: Omit<Event, 'id' | 'tripId' | 'dayId'>) => void;
  dayDate?: Date;
  tripUsers?: AppUser[];
  currentUserId?: string;
  tripBudget?: number;
  tripSpent?: number;
  mode?: EventFormMode;
  initialEvent?: Event;
  lockHolderName?: string;
}

const toTimeString = (d: Date): string => {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const toDateTimeLocal = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mo}-${dd}T${toTimeString(d)}`;
};

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

const EventFormModal = ({ isOpen, onClose, onSubmit, dayDate, tripUsers, currentUserId, tripBudget, tripSpent, mode = 'create', initialEvent, lockHolderName }: EventFormModalProps) => {
  const readOnly = mode === 'readonly';
  const [category, setCategory] = useState<EventCategory>('Activity');
  const [type, setType] = useState<Event['type']>('Hiking');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [dateValue, setDateValue] = useState('');
  const [timezone, setTimezone] = useState('America/Chicago');
  const [cost, setCost] = useState('');
  const [paidBy, setPaidBy] = useState<string>(currentUserId ?? '');
  const [paidByOpen, setPaidByOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const locationContainerRef = useRef<HTMLDivElement>(null);

  const filteredTypes = ALL_EVENT_TYPES.filter(t => EVENT_CATEGORY[t] === category);

  const handleCategoryChange = (cat: EventCategory) => {
    setCategory(cat);
    const typesInCat = ALL_EVENT_TYPES.filter(t => EVENT_CATEGORY[t] === cat);
    if (typesInCat.length > 0 && !typesInCat.includes(type)) {
      setType(typesInCat[0]);
    }
  };

  useEffect(() => {
    if (isOpen && currentUserId && mode === 'create') {
      setPaidBy(currentUserId);
    }
  }, [isOpen, currentUserId, mode]);

  // Pre-populate fields from initialEvent when the modal opens in edit or
  // readonly mode. Keyed on the event id so reopening with a different event
  // resets the form.
  useEffect(() => {
    if (!isOpen || !initialEvent) return;
    setCategory(EVENT_CATEGORY[initialEvent.type]);
    setType(initialEvent.type);
    setName(initialEvent.name);
    setLocation(initialEvent.location ?? '');
    setLat(initialEvent.lat);
    setLng(initialEvent.lng);
    setTimezone(initialEvent.timezone ?? 'America/Chicago');
    setCost(initialEvent.cost != null ? String(initialEvent.cost) : '');
    setPaidBy(initialEvent.paidBy ?? '');
    const start = toDate(initialEvent.startDate as Parameters<typeof toDate>[0]);
    const end = initialEvent.endDate
      ? toDate(initialEvent.endDate as Parameters<typeof toDate>[0])
      : null;
    if (dayDate) {
      setStartTime(toTimeString(start));
      setEndTime(end ? toTimeString(end) : '');
    } else {
      setDateValue(toDateTimeLocal(start));
    }
  }, [isOpen, initialEvent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
  if (!isOpen) return;

  let isMounted = true;

  const init = async () => {
    // 1. Set your global options (once)
    setOptions({
      key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
      v: "weekly",
    });

    try {
      // 2. Use the functional importLibrary instead of the loader class
      const { PlaceAutocompleteElement, Place } =
        (await importLibrary("places")) as google.maps.PlacesLibrary & {
          PlaceAutocompleteElement: new () => HTMLElement;
        };

      if (!isMounted || !locationContainerRef.current) return;

      // 3. Setup the Web Component
      const el = new PlaceAutocompleteElement();
      
      locationContainerRef.current.innerHTML = "";
      locationContainerRef.current.appendChild(el);

      el.addEventListener("gmp-select", async (event: any) => {
        const placeId = event.placePrediction.placeId;
        const fullPlace = new Place({ id: placeId });

        await fullPlace.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });

        if (isMounted) {
          setLocation(fullPlace.formattedAddress || fullPlace.displayName || "");
          const loc = fullPlace.location;
          if (loc) {
            setLat(typeof loc.lat === 'function' ? loc.lat() : (loc as unknown as { lat: number }).lat);
            setLng(typeof loc.lng === 'function' ? loc.lng() : (loc as unknown as { lng: number }).lng);
          } else {
            setLat(undefined);
            setLng(undefined);
          }
        }
      });
    } catch (error) {
      console.error("Error loading Google Maps:", error);
    }
  };

  init();

  return () => {
    isMounted = false;
    if (locationContainerRef.current) {
      locationContainerRef.current.innerHTML = "";
    }
  };
}, [isOpen]);

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
      ...(location ? { location } : {}),
      ...(lat !== undefined ? { lat } : {}),
      ...(lng !== undefined ? { lng } : {}),
      startDate: eventDate,
      endDate: eventEndDate,
      timezone,
      cost: cost !== '' ? parseFloat(cost) : null,
      paidBy: paidBy || null,
    });

    if (mode === 'create') {
      setCategory('Activity');
      setType('Hiking');
      setName('');
      setLocation('');
      setLat(undefined);
      setLng(undefined);
      setStartTime('');
      setEndTime('');
      setDateValue('');
      setTimezone('America/Chicago');
      setCost('');
      setPaidBy(currentUserId ?? '');
    }
    setPaidByOpen(false);
    onClose();
  };

  return createPortal(
    isOpen ? (
    <div className="overlay-bottom">
      <div className="overlay-scrim" onClick={onClose} />
      <div className="overlay-panel overlay-panel--lg rounded-t-2xl p-6 pb-10 max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="event-modal-header">
          <h2 className="event-modal-title">
            {mode === 'edit' ? 'Edit Event' : mode === 'readonly' ? 'Event (locked)' : 'New Event'}
          </h2>
          <button
            onClick={onClose}
            className="event-modal-close-btn"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {readOnly && (
          <div className="event-modal-readonly-banner" role="status">
            <span className="event-modal-readonly-banner-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <div className="event-modal-readonly-banner-text">
              <span className="event-modal-readonly-banner-title">
                <span className="event-modal-readonly-banner-pulse" aria-hidden="true" />
                {lockHolderName ?? 'Another user'}
                <span className="event-modal-readonly-banner-separator"> · </span>
                <span className="event-modal-readonly-banner-live">editing now</span>
              </span>
              <span className="event-modal-readonly-banner-subtitle">
                You're viewing this event in read-only mode.
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="event-modal-form">
          <fieldset disabled={readOnly} className="event-modal-fieldset">
          {/* Category */}
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
            { <div ref={locationContainerRef} /> }
            {/* <input
              id="event-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hike to Old Faithful"
              className="form-input"
              required
            /> */}
          </div>

          {/* Location */}
          <div>
            <label htmlFor="event-location" className="form-label">Location</label>
            <input
              id="event-location"
              type="text"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setLat(undefined);
                setLng(undefined);
              }}
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
                    Trip Expenses: {tripSpent.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
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

         </fieldset>
          {!readOnly && (
            <button type="submit" className="event-modal-submit-btn">
              {mode === 'edit' ? 'Save Changes' : 'Add Event'}
            </button>
          )}
        </form>
      </div>
    </div>
    ) : null,
    document.body
  );
};

export default EventFormModal;

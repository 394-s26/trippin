import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Event, EVENT_CATEGORY, EventCategory } from '../types/event';
import { AppUser } from '../types/auth';
import { EVENT_TYPE_ICONS } from '../services/eventSvgIcons';
import { UserIcon } from '../services/svgIcons';
import { EVENT_COLORS } from '../utilities/eventColors';
import UserAvatar from './UserAvatar';
import TimeSelect, { toMinutes } from './TimeSelect';
import { toDate } from '../utilities/timestamps';
import './EventFormModal.css';

export type EventFormMode = 'create' | 'edit' | 'readonly';

export interface TripDayRef {
  id: string;
  date: Date;
}

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: Omit<Event, 'id' | 'tripId'>) => void;
  tripDays?: TripDayRef[];
  initialDayId?: string;
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

const computeSmartDefaults = (): { start: string; end: string } => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 10, 0, 0);
  const rounded = new Date(now);
  const remainder = rounded.getMinutes() % 15;
  if (remainder !== 0) rounded.setMinutes(rounded.getMinutes() + (15 - remainder));
  let startMins = rounded.getHours() * 60 + rounded.getMinutes();
  if (startMins > 22 * 60 + 45) startMins = 22 * 60 + 45;
  const endMins = startMins + 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  return { start: fmt(startMins), end: fmt(endMins) };
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

const TZ_LABEL: Record<string, string> = {
  'America/New_York':    '(GMT-05:00) Eastern Time — New York',
  'America/Chicago':     '(GMT-06:00) Central Time — Chicago',
  'America/Denver':      '(GMT-07:00) Mountain Time — Denver',
  'America/Los_Angeles': '(GMT-08:00) Pacific Time — Los Angeles',
  'America/Anchorage':   '(GMT-09:00) Alaska Time — Anchorage',
  'Pacific/Honolulu':    '(GMT-10:00) Hawaii Time — Honolulu',
  'UTC':                 '(GMT+00:00) UTC',
};

const formatChipDate = (d: Date): string =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const formatPopoverDate = (d: Date): string =>
  d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

// Combines a calendar date and HH:MM time into a single Date.
const combineDateAndTime = (date: Date, hhmm: string): Date => {
  const out = new Date(date);
  if (hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    out.setHours(h, m, 0, 0);
  } else {
    out.setHours(0, 0, 0, 0);
  }
  return out;
};

// Adds a positive minute offset to an HH:MM time, capping at 23:45 for the
// chip picker (matching its 15-min step ceiling). Returns HH:MM.
const shiftTime = (hhmm: string, deltaMins: number): string => {
  const start = toMinutes(hhmm);
  if (start == null) return hhmm;
  const total = Math.max(0, Math.min(23 * 60 + 45, start + deltaMins));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};

const EventFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  tripDays = [],
  initialDayId,
  tripUsers,
  currentUserId,
  tripBudget,
  tripSpent,
  mode = 'create',
  initialEvent,
  lockHolderName,
}: EventFormModalProps) => {
  const readOnly = mode === 'readonly';
  const [category, setCategory] = useState<EventCategory>('Activity');
  const [type, setType] = useState<Event['type']>('Hiking');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startDayId, setStartDayId] = useState<string>('');
  const [endDayId, setEndDayId] = useState<string>('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [timezone, setTimezone] = useState('America/Chicago');
  const [tzExpanded, setTzExpanded] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [cost, setCost] = useState('');
  const [paidBy, setPaidBy] = useState<string>(currentUserId ?? '');
  const [paidByOpen, setPaidByOpen] = useState(false);
  const [startDayOpen, setStartDayOpen] = useState(false);
  const [endDayOpen, setEndDayOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const startDayRef = useRef<HTMLDivElement>(null);
  const endDayRef = useRef<HTMLDivElement>(null);

  const filteredTypes = ALL_EVENT_TYPES.filter(t => EVENT_CATEGORY[t] === category);
  const startDay = tripDays.find(d => d.id === startDayId);
  const endDay = tripDays.find(d => d.id === endDayId);

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

  // Seed defaults when opening in create mode.
  useEffect(() => {
    if (!isOpen || mode !== 'create' || tripDays.length === 0) return;
    const initialId = initialDayId ?? tripDays[0].id;
    const defaults = computeSmartDefaults();
    setStartDayId(prev => prev || initialId);
    setEndDayId(prev => prev || initialId);
    setStartTime(prev => prev || defaults.start);
    setEndTime(prev => prev || defaults.end);
    setAllDay(false);
    setColor(null);
    setTzExpanded(false);
  }, [isOpen, mode, initialDayId, tripDays.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-populate from initialEvent in edit/readonly modes.
  useEffect(() => {
    if (!isOpen || !initialEvent) return;
    setCategory(EVENT_CATEGORY[initialEvent.type]);
    setType(initialEvent.type);
    setName(initialEvent.name);
    setLocation(initialEvent.location ?? '');
    setTimezone(initialEvent.timezone ?? 'America/Chicago');
    setCost(initialEvent.cost != null ? String(initialEvent.cost) : '');
    setPaidBy(initialEvent.paidBy ?? '');
    setColor(initialEvent.color ?? null);
    setTzExpanded(false);

    const start = toDate(initialEvent.startDate as Parameters<typeof toDate>[0]);
    const end = initialEvent.endDate
      ? toDate(initialEvent.endDate as Parameters<typeof toDate>[0])
      : start;

    // Match start/end day to nearest trip day by calendar date.
    const dayMatch = (d: Date) =>
      tripDays.find(td => td.date.toDateString() === d.toDateString())?.id
      ?? initialEvent.dayId;
    const sId = dayMatch(start);
    const eId = dayMatch(end);
    setStartDayId(sId);
    setEndDayId(eId);

    // Detect all-day: start at 00:00 of startDay AND end at ~23:59 of endDay.
    const isAllDay =
      start.getHours() === 0 && start.getMinutes() === 0 &&
      end.getHours() === 23 && end.getMinutes() >= 59;

    if (isAllDay) {
      setAllDay(true);
      const defaults = computeSmartDefaults();
      setStartTime(defaults.start);
      setEndTime(defaults.end);
    } else {
      setAllDay(false);
      setStartTime(toTimeString(start));
      setEndTime(toTimeString(end));
    }
  }, [isOpen, initialEvent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!paidByOpen && !startDayOpen && !endDayOpen) return;
    const handler = (e: MouseEvent) => {
      if (paidByOpen && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPaidByOpen(false);
      }
      if (startDayOpen && startDayRef.current && !startDayRef.current.contains(e.target as Node)) {
        setStartDayOpen(false);
      }
      if (endDayOpen && endDayRef.current && !endDayRef.current.contains(e.target as Node)) {
        setEndDayOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [paidByOpen, startDayOpen, endDayOpen]);

  const costNum = cost !== '' ? parseFloat(cost) : 0;
  const wouldExceedBudget = tripBudget != null && tripBudget > 0 && tripSpent != null && (tripSpent + costNum) > tripBudget;

  // Slide end forward by the same delta when the user changes start time —
  // preserving duration (Google Calendar behavior).
  const handleStartTimeChange = (next: string) => {
    const prev = toMinutes(startTime);
    const nextMins = toMinutes(next);
    setStartTime(next);
    if (prev == null || nextMins == null) return;
    const delta = nextMins - prev;
    if (delta === 0) return;
    setEndTime(curr => shiftTime(curr || next, delta));
  };

  // Editing end time updates duration without moving start. If the user pulls
  // end before start (same day), snap end forward to start + 15 min.
  const handleEndTimeChange = (next: string) => {
    const startMins = toMinutes(startTime);
    const nextMins = toMinutes(next);
    if (startMins == null || nextMins == null) {
      setEndTime(next);
      return;
    }
    if (startDayId === endDayId && nextMins <= startMins) {
      setEndTime(shiftTime(startTime, 15));
      return;
    }
    setEndTime(next);
  };

  const handleStartDayChange = (newId: string) => {
    setStartDayId(newId);
    setStartDayOpen(false);
    // Keep end ≥ start by index in the trip-days list.
    const startIdx = tripDays.findIndex(d => d.id === newId);
    const endIdx = tripDays.findIndex(d => d.id === endDayId);
    if (startIdx >= 0 && endIdx >= 0 && endIdx < startIdx) {
      setEndDayId(newId);
    }
  };

  const handleEndDayChange = (newId: string) => {
    setEndDayId(newId);
    setEndDayOpen(false);
    const startIdx = tripDays.findIndex(d => d.id === startDayId);
    const endIdx = tripDays.findIndex(d => d.id === newId);
    if (startIdx >= 0 && endIdx >= 0 && endIdx < startIdx) {
      setStartDayId(newId);
    }
  };

  const handleSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (tripDays.length === 0) return;
    const sDay = tripDays.find(d => d.id === startDayId) ?? tripDays[0];
    const eDay = tripDays.find(d => d.id === endDayId) ?? sDay;

    let eventStart: Date;
    let eventEnd: Date;
    if (allDay) {
      eventStart = new Date(sDay.date);
      eventStart.setHours(0, 0, 0, 0);
      eventEnd = new Date(eDay.date);
      eventEnd.setHours(23, 59, 0, 0);
    } else {
      eventStart = combineDateAndTime(sDay.date, startTime);
      eventEnd = combineDateAndTime(eDay.date, endTime);
      if (eventEnd < eventStart) {
        // Final guard: snap end to start + 15 min.
        eventEnd = new Date(eventStart.getTime() + 15 * 60 * 1000);
      }
    }

    onSubmit({
      type,
      dayId: sDay.id,
      name,
      location: location || undefined,
      startDate: eventStart,
      endDate: eventEnd,
      timezone,
      cost: cost !== '' ? parseFloat(cost) : null,
      paidBy: paidBy || null,
      color: color || null,
    });

    if (mode === 'create') {
      setCategory('Activity');
      setType('Hiking');
      setName('');
      setLocation('');
      const defaults = computeSmartDefaults();
      setStartTime(defaults.start);
      setEndTime(defaults.end);
      const initialId = initialDayId ?? tripDays[0].id;
      setStartDayId(initialId);
      setEndDayId(initialId);
      setTimezone('America/Chicago');
      setTzExpanded(false);
      setCost('');
      setPaidBy(currentUserId ?? '');
      setAllDay(false);
      setColor(null);
    }
    setPaidByOpen(false);
    setStartDayOpen(false);
    setEndDayOpen(false);
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
            <input
              id="event-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hike to Old Faithful"
              className="form-input"
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

          {/* When (chip row + all-day + time zone) */}
          <div className="when-block">
            <div className="when-row">
              <span className="when-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </span>
              <div className="when-chips">
                <div className="date-chip-wrap" ref={startDayRef}>
                  <button
                    type="button"
                    className="date-chip"
                    onClick={() => setStartDayOpen(o => !o)}
                    disabled={readOnly || tripDays.length === 0}
                    aria-haspopup="listbox"
                    aria-expanded={startDayOpen}
                  >
                    {startDay ? formatChipDate(startDay.date) : 'Start day'}
                  </button>
                  {startDayOpen && (
                    <div className="date-chip-options" role="listbox">
                      {tripDays.map((d, i) => (
                        <button
                          key={d.id}
                          type="button"
                          role="option"
                          aria-selected={d.id === startDayId}
                          className={`date-chip-option${d.id === startDayId ? ' date-chip-option--selected' : ''}`}
                          onClick={() => handleStartDayChange(d.id)}
                        >
                          <span className="date-chip-option-num">Day {i + 1}</span>
                          <span className="date-chip-option-date">{formatPopoverDate(d.date)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {!allDay && (
                  <TimeSelect
                    id="event-start-time"
                    value={startTime}
                    onChange={handleStartTimeChange}
                    disabled={readOnly}
                    ariaLabel="Start time"
                    variant="chip"
                  />
                )}

                <span className="when-dash" aria-hidden="true">–</span>

                {!allDay && (
                  <TimeSelect
                    id="event-end-time"
                    value={endTime}
                    onChange={handleEndTimeChange}
                    anchorMinutes={toMinutes(startTime) ?? undefined}
                    disabled={readOnly}
                    ariaLabel="End time"
                    variant="chip"
                  />
                )}

                <div className="date-chip-wrap" ref={endDayRef}>
                  <button
                    type="button"
                    className="date-chip"
                    onClick={() => setEndDayOpen(o => !o)}
                    disabled={readOnly || tripDays.length === 0}
                    aria-haspopup="listbox"
                    aria-expanded={endDayOpen}
                  >
                    {endDay ? formatChipDate(endDay.date) : 'End day'}
                  </button>
                  {endDayOpen && (
                    <div className="date-chip-options" role="listbox">
                      {tripDays.map((d, i) => (
                        <button
                          key={d.id}
                          type="button"
                          role="option"
                          aria-selected={d.id === endDayId}
                          className={`date-chip-option${d.id === endDayId ? ' date-chip-option--selected' : ''}`}
                          onClick={() => handleEndDayChange(d.id)}
                        >
                          <span className="date-chip-option-num">Day {i + 1}</span>
                          <span className="date-chip-option-date">{formatPopoverDate(d.date)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="when-meta-row">
              <label className="when-allday">
                <input
                  type="checkbox"
                  checked={allDay}
                  disabled={readOnly}
                  onChange={(e) => setAllDay(e.target.checked)}
                />
                <span>All-day</span>
              </label>
              <button
                type="button"
                className="when-tz-link"
                onClick={() => setTzExpanded(v => !v)}
                disabled={readOnly}
              >
                Time zone
              </button>
            </div>

            {tzExpanded && (
              <select
                id="event-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="form-input when-tz-select"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{TZ_LABEL[tz] ?? tz}</option>
                ))}
              </select>
            )}
          </div>

          {/* Color label */}
          <div>
            <label className="form-label">Label</label>
            <div className="color-swatch-row">
              <button
                type="button"
                className={`color-swatch color-swatch--none${color == null ? ' color-swatch--selected' : ''}`}
                onClick={() => setColor(null)}
                aria-label="No color"
                aria-pressed={color == null}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="5" y1="19" x2="19" y2="5" />
                </svg>
              </button>
              {EVENT_COLORS.map((c) => (
                <button
                  key={c.token}
                  type="button"
                  className={`color-swatch${color === c.token ? ' color-swatch--selected' : ''}`}
                  style={{ backgroundColor: c.hex }}
                  onClick={() => setColor(c.token)}
                  aria-label={c.label}
                  aria-pressed={color === c.token}
                >
                  {color === c.token && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
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

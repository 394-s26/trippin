import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Event, EVENT_CATEGORY } from '../types/event';
import { AppUser } from '../types/auth';
import { UserIcon, BallotBoxIcon, BallotPaperIcon } from '../services/svgIcons';
import { EVENT_COLORS } from '../utilities/eventColors';
import UserAvatar from './UserAvatar';
import TimeSelect, { toMinutes } from './TimeSelect';
import TimezoneModal from './TimezoneModal';
import { toDate } from '../utilities/timestamps';
import './EventFormModal.css';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

export type EventFormMode = 'create' | 'edit' | 'readonly';

export interface TripDayRef {
  id: string;
  date: Date;
}

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: Omit<Event, 'id' | 'tripId'> & { isSuggestion?: boolean }) => void;
  tripDays?: TripDayRef[];
  initialDayId?: string;
  tripUsers?: AppUser[];
  currentUserId?: string;
  tripBudget?: number;
  tripSpent?: number;
  canCreateEvent?: boolean;
  canProposeEvent?: boolean;
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

type FormCategory = 'Transportation' | 'Lodging' | 'Activity' | 'None';
const CATEGORIES: FormCategory[] = ['None', 'Transportation', 'Lodging', 'Activity'];
const DEFAULT_TYPE_BY_FORM_CATEGORY: Record<FormCategory, Event['type']> = {
  Transportation: 'Car',
  Lodging: 'Hotel',
  Activity: 'Hiking',
  None: 'None',
};
const toFormCategory = (eventType: Event['type']): FormCategory => {
  const sourceCategory = EVENT_CATEGORY[eventType];
  if (sourceCategory === 'Transportation') return 'Transportation';
  if (sourceCategory === 'Lodging') return 'Lodging';
  if (sourceCategory === 'None') return 'None';
  return 'None';
};

// Full IANA time zone list when the runtime supports it; otherwise a sensible
// fallback covering common regions. `Intl.supportedValuesOf` is available in
// all modern evergreen browsers (Chrome 99+, Safari 15.4+, Firefox 93+).
const TIMEZONES: string[] = (() => {
  type IntlWithSupportedValues = typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  const intl = Intl as IntlWithSupportedValues;
  const fromIntl = intl.supportedValuesOf?.('timeZone');
  if (fromIntl && fromIntl.length > 0) return fromIntl.slice().sort();
  return [
    'UTC',
    'America/Anchorage', 'America/Chicago', 'America/Denver',
    'America/Los_Angeles', 'America/New_York', 'America/Phoenix',
    'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
    'Europe/Moscow', 'Africa/Cairo', 'Africa/Johannesburg',
    'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo',
    'Asia/Shanghai', 'Australia/Sydney', 'Pacific/Auckland', 'Pacific/Honolulu',
  ];
})();

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
  canCreateEvent = false,
  canProposeEvent = false,
  mode = 'create',
  initialEvent,
  lockHolderName,
}: EventFormModalProps) => {
  const readOnly = mode === 'readonly';
  const [category, setCategory] = useState<FormCategory>('None');
  const [type, setType] = useState<Event['type']>('None');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [startDayId, setStartDayId] = useState<string>('');
  const [endDayId, setEndDayId] = useState<string>('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [timezone, setTimezone] = useState('America/Chicago');
  const [endTimezone, setEndTimezone] = useState<string>('America/Chicago');
  const [useSeparateEndTz, setUseSeparateEndTz] = useState(false);
  const [tzModalOpen, setTzModalOpen] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [cost, setCost] = useState('');
  const [paidBy, setPaidBy] = useState<string>(currentUserId ?? '');
  const [paidByOpen, setPaidByOpen] = useState(false);
  const [startDayOpen, setStartDayOpen] = useState(false);
  const [endDayOpen, setEndDayOpen] = useState(false);
  const [isSuggestion, setIsSuggestion] = useState(false);
  const [ballotAnimKey, setBallotAnimKey] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const locationContainerRef = useRef<HTMLDivElement>(null);
  const startDayRef = useRef<HTMLDivElement>(null);
  const endDayRef = useRef<HTMLDivElement>(null);

  const autocompleteRef = useRef<any>(null);

  const suggestionOnly = !canCreateEvent && canProposeEvent;
  const showSuggestionToggle = canCreateEvent || canProposeEvent;

  const isLodgingType = EVENT_CATEGORY[type] === 'Lodging';
  const startDay = tripDays.find(d => d.id === startDayId);
  const endDay = tripDays.find(d => d.id === endDayId);

  const handleCategoryChange = (cat: FormCategory) => {
    setCategory(cat);
    const newType = DEFAULT_TYPE_BY_FORM_CATEGORY[cat];
    setType(newType);
    const newIsLodging = EVENT_CATEGORY[newType] === 'Lodging';
    if (newIsLodging) {
      setAllDay(false);
      // Ensure end day is at least 1 day after start day
      const startIdx = tripDays.findIndex(d => d.id === startDayId);
      const endIdx = tripDays.findIndex(d => d.id === endDayId);
      if (startIdx >= 0 && endIdx <= startIdx && tripDays[startIdx + 1]) {
        setEndDayId(tripDays[startIdx + 1].id);
      }
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
    setStartDayId(initialId);
    setEndDayId(initialId);
    setStartTime(prev => prev || defaults.start);
    setEndTime(prev => prev || defaults.end);
    setAllDay(false);
    setColor(null);
    setTzModalOpen(false);
  }, [isOpen, mode, initialDayId, tripDays.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-populate from initialEvent in edit/readonly modes.
  useEffect(() => {
    if (!isOpen || !initialEvent) return;
    setCategory(toFormCategory(initialEvent.type));
    setType(initialEvent.type);
    setName(initialEvent.name);
    setLocation(initialEvent.location ?? '');
    setLat(initialEvent.lat);
    setLng(initialEvent.lng);
    setTimezone(initialEvent.timezone ?? 'America/Chicago');
    setEndTimezone(initialEvent.endTimezone ?? initialEvent.timezone ?? 'America/Chicago');
    setUseSeparateEndTz(initialEvent.endTimezone != null);
    setCost(initialEvent.cost != null ? String(initialEvent.cost) : '');
    setPaidBy(initialEvent.paidBy ?? '');
    setColor(initialEvent.color ?? null);
    setTzModalOpen(false);

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

    // Prefer the explicit allDay flag; fall back to the legacy 00:00/23:59
    // heuristic for events created before the flag existed.
    const legacyAllDay =
      start.getHours() === 0 && start.getMinutes() === 0 &&
      end.getHours() === 23 && end.getMinutes() >= 59;
    const isAllDay = initialEvent.allDay === true || legacyAllDay;

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

  // Reset isSuggestion when the modal opens based on role permissions.
  useEffect(() => {
    if (!isOpen) return;
    setIsSuggestion(suggestionOnly);
  }, [isOpen, suggestionOnly]);

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

  const tripDaysRef = useRef(tripDays);
  tripDaysRef.current = tripDays;

  // Non-lodging events can span at most 2 days (start day + the next day).
  // If the user switches away from lodging or the start day moves, clamp the
  // end day so it is no more than 1 day after the start day.
  useEffect(() => {
    if (isLodgingType) return;
    if (!startDayId || !endDayId) return;
    const days = tripDaysRef.current;
    const startIdx = days.findIndex(d => d.id === startDayId);
    const endIdx = days.findIndex(d => d.id === endDayId);
    if (startIdx >= 0 && endIdx > startIdx + 1) {
      setEndDayId(days[startIdx + 1]?.id ?? startDayId);
    }
  }, [isLodgingType, startDayId, endDayId]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const init = async () => {
      setOptions({
        key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        v: "weekly",
      });

      try {
        const { PlaceAutocompleteElement } =
          (await importLibrary("places")) as any;

        if (!isMounted || !locationContainerRef.current) return;

        const el = new PlaceAutocompleteElement();

        el.classList.add("form-input");
        el.style.display = "block";
        el.style.width = "100%";
        el.style.color = "#374151";

        autocompleteRef.current = el;

        // Use initialEvent directly if location state hasn't updated yet
        if (initialEvent?.location)
          el.value = initialEvent.location;
        else if (location)
          el.value = location;

        locationContainerRef.current.innerHTML = "";
        locationContainerRef.current.appendChild(el);

        const handleInput = (event: any) => {
          if (!isMounted) return;
          const rawValue = event?.target?.value;
          const nextLocation = typeof rawValue === "string" ? rawValue : String(el.value ?? "");
          setLocation(nextLocation);
          setLat(undefined);
          setLng(undefined);
        };

        const handleSelect = async (event: any) => {
          const placeId = event.placePrediction.placeId;
          const { Place } = (await importLibrary("places")) as any;
          const fullPlace = new Place({ id: placeId });

          await fullPlace.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });

          if (isMounted) {
            const placeName = fullPlace.displayName || "";
            const placeAddress = fullPlace.formattedAddress || "";
            const placeLocation = fullPlace.location;
            const nextLat =
              typeof placeLocation?.lat === "function"
                ? placeLocation.lat()
                : placeLocation?.lat;
            const nextLng =
              typeof placeLocation?.lng === "function"
                ? placeLocation.lng()
                : placeLocation?.lng;

            setLocation(placeAddress);
            if (typeof nextLat === "number" && typeof nextLng === "number") {
              setLat(nextLat);
              setLng(nextLng);
            } else {
              setLat(undefined);
              setLng(undefined);
            }

            setName((currentName) => {
              // If the name is truly empty or just whitespace, use the place name
              if (!currentName || currentName.trim() === "") {
                return placeName;
              }
              return currentName;  // Otherwise, keep what the user already typed
            });
            el.value = placeAddress;
          }
        };

        el.addEventListener("input", handleInput);
        el.addEventListener("gmp-select", handleSelect);
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
  const submitLabel = mode === 'edit' ? 'Save Changes' : isSuggestion ? 'Submit Suggestion' : 'Add Event';

  // Start and end times are independent; changing start should not mutate end.
  const handleStartTimeChange = (next: string) => {
    setStartTime(next);
    const prevStartMins = toMinutes(startTime);
    const prevEndMins = toMinutes(endTime);
    const nextMins = toMinutes(next);
    if (prevStartMins != null && prevEndMins != null && nextMins != null) {
      const gap = prevEndMins - prevStartMins;
      setEndTime(shiftTime(next, gap));
    }
  };

  // Editing end time directly: if it lands before start and there is a later
  // day available within the allowed range, advance the end day by one.
  // Otherwise snap forward to start + 15 min on the same day.
  const handleEndTimeChange = (next: string) => {
    const startMins = toMinutes(startTime);
    const nextMins = toMinutes(next);
    if (startMins == null || nextMins == null) {
      setEndTime(next);
      return;
    }
    if (startDayId === endDayId && nextMins <= startMins) {
      const days = tripDaysRef.current;
      const startIdx = days.findIndex(d => d.id === startDayId);
      const maxIdx = isLodgingType ? days.length - 1 : startIdx + 1;
      const nextDay = startIdx >= 0 && startIdx < maxIdx ? days[startIdx + 1] : null;
      if (nextDay) {
        setEndDayId(nextDay.id);
      } else {
        setEndTime(shiftTime(startTime, 15));
        return;
      }
    }
    setEndTime(next);
  };

  const handleStartDayChange = (newId: string) => {
    setStartDayId(newId);
    setStartDayOpen(false);
    if (allDay) {
      setEndDayId(newId);
      return;
    }
    const startIdx = tripDays.findIndex(d => d.id === newId);
    const endIdx = tripDays.findIndex(d => d.id === endDayId);
    if (isLodgingType) {
      // Lodging must span at least 2 days; ensure end day is after start day
      if (startIdx >= 0 && endIdx <= startIdx) {
        setEndDayId(tripDays[startIdx + 1]?.id ?? newId);
      }
    } else {
      if (startIdx >= 0 && endIdx >= 0 && endIdx < startIdx) {
        setEndDayId(newId);
      }
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
    const rawEndDay = tripDays.find(d => d.id === endDayId) ?? sDay;
    const eDay = rawEndDay;

    let eventStart: Date;
    let eventEnd: Date;
    if (allDay) {
      eventStart = new Date(sDay.date);
      eventStart.setHours(0, 0, 0, 0);
      eventEnd = new Date(eDay.date);
      eventEnd.setHours(0, 0, 0, 0);
    } else {
      eventStart = combineDateAndTime(sDay.date, startTime);
      eventEnd = combineDateAndTime(eDay.date, endTime);
      if (eventEnd < eventStart) {
        eventEnd = new Date(eventStart.getTime() + 15 * 60 * 1000);
      }
    }

    onSubmit({
      type,
      dayId: sDay.id,
      name,
      ...(location ? { location } : {}),
      ...(lat !== undefined ? { lat } : {}),
      ...(lng !== undefined ? { lng } : {}),
      startDate: eventStart,
      endDate: eventEnd,
      timezone,
      endTimezone: useSeparateEndTz ? endTimezone : null,
      cost: cost !== '' ? parseFloat(cost) : null,
      paidBy: paidBy || null,
      color: color || null,
      allDay,
      isSuggestion,
    });

    if (mode === 'create') {
      setCategory('None');
      setType('None');
      setName('');
      setLocation('');
      setLat(undefined);
      setLng(undefined);
      const defaults = computeSmartDefaults();
      setStartTime(defaults.start);
      setEndTime(defaults.end);
      const initialId = initialDayId ?? tripDays[0].id;
      setStartDayId(initialId);
      setEndDayId(initialId);
      setTimezone('America/Chicago');
      setEndTimezone('America/Chicago');
      setUseSeparateEndTz(false);
      setTzModalOpen(false);
      setCost('');
      setPaidBy(currentUserId ?? '');
      setAllDay(false);
      setColor(null);
      setIsSuggestion(suggestionOnly);
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
            <span
              key={mode === 'create' ? `create-${isSuggestion}` : mode}
              className="event-modal-title-text"
            >
              {mode === 'edit' ? 'Edit Event' : mode === 'readonly' ? 'Event (locked)' : isSuggestion ? 'New Event Suggestion' : 'New Event'}
            </span>
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

          {/* Suggestion toggle */}
          {showSuggestionToggle && mode === 'create' && (
            <div
              className={`suggestion-toggle-card${suggestionOnly ? ' suggestion-toggle-card--locked' : ''}${isSuggestion ? ' suggestion-toggle-card--on' : ''}`}
            >
              <div className="ballot-anim" aria-hidden="true">
                <BallotBoxIcon className="ballot-anim__box" size={44} />
                <BallotPaperIcon
                  key={ballotAnimKey}
                  className="ballot-anim__paper"
                  size={20}
                />
              </div>
              <div className="suggestion-toggle-text">
                <p className="suggestion-toggle-title">Suggestion mode</p>
                <p className="suggestion-toggle-copy">
                  {suggestionOnly
                    ? 'Your role can only propose events, so this will go out for a vote automatically.'
                    : 'Turn this on to let the group vote before the event becomes part of the plan.'}
                </p>
              </div>
              <button
                type="button"
                className={`suggestion-toggle-switch${isSuggestion ? ' suggestion-toggle-switch--on' : ''}`}
                aria-pressed={isSuggestion}
                aria-label="Toggle suggestion mode"
                disabled={suggestionOnly}
                onClick={() =>
                  setIsSuggestion((current) => {
                    const next = !current;
                    if (next) setBallotAnimKey((k) => k + 1);
                    return next;
                  })
                }
              >
                <span className="suggestion-toggle-knob" />
              </button>
            </div>
          )}

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

          {/* Name */}
          <div>
            <label htmlFor="event-name" className="form-label">Name {name === "" && <span className="normal-case font-normal text-orange-500">(required)</span>}</label>
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
            <label htmlFor="event-location" className="form-label">Location <span className="normal-case font-normal text-gray-400">(optional)</span></label>
            <div ref={locationContainerRef} />
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
                <div className="when-pair when-pair-start">
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

                  <span className={`when-time-fade${allDay ? ' when-time-fade--off' : ''}`} aria-hidden={allDay}>
                    <TimeSelect
                      id="event-start-time"
                      value={startTime}
                      onChange={handleStartTimeChange}
                      disabled={readOnly || allDay}
                      ariaLabel="Start time"
                      variant="chip"
                    />
                  </span>
                </div>

                <span className="when-dash" aria-hidden="true">–</span>

                <div className="when-pair when-pair-end">
                  <span className={`when-time-fade${allDay ? ' when-time-fade--off' : ''}`} aria-hidden={allDay}>
                    <div className="date-chip-wrap" ref={endDayRef}>
                      <button
                        type="button"
                        className="date-chip"
                        onClick={() => setEndDayOpen(o => !o)}
                        disabled={readOnly || allDay || tripDays.length === 0}
                        aria-haspopup="listbox"
                        aria-expanded={endDayOpen}
                      >
                        {endDay ? formatChipDate(endDay.date) : 'End day'}
                      </button>
                      {endDayOpen && (
                        <div className="date-chip-options" role="listbox">
                          {tripDays
                            .filter((d) => {
                              const startIdx = tripDays.findIndex(x => x.id === startDayId);
                              const dIdx = tripDays.findIndex(x => x.id === d.id);
                              if (isLodgingType) return dIdx > startIdx;
                              return dIdx >= startIdx && dIdx <= startIdx + 1;
                            })
                            .map((d) => {
                              const i = tripDays.findIndex(x => x.id === d.id);
                              return (
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
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </span>

                  <span className={`when-time-fade${allDay ? ' when-time-fade--off' : ''}`} aria-hidden={allDay}>
                    <TimeSelect
                      id="event-end-time"
                      value={endTime}
                      onChange={handleEndTimeChange}
                      anchorMinutes={toMinutes(startTime) ?? undefined}
                      dayOffset={Math.max(
                        0,
                        tripDays.findIndex(d => d.id === endDayId)
                          - tripDays.findIndex(d => d.id === startDayId),
                      )}
                      disabled={readOnly || allDay}
                      ariaLabel="End time"
                      variant="chip"
                    />
                  </span>
                </div>
              </div>
            </div>

            <div className="when-meta-row">
              <label className={`when-allday${isLodgingType ? ' when-allday--disabled' : ''}`}>
                <input
                  type="checkbox"
                  checked={allDay}
                  disabled={readOnly || isLodgingType}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setAllDay(next);
                    if (next) setEndDayId(startDayId);
                  }}
                />
                <span>All-day</span>
              </label>
              <button
                type="button"
                className="when-tz-link"
                onClick={() => setTzModalOpen(true)}
                disabled={readOnly}
              >
                Time zone
              </button>
            </div>
          </div>

          <TimezoneModal
            isOpen={tzModalOpen}
            onClose={() => setTzModalOpen(false)}
            zones={TIMEZONES}
            startValue={timezone}
            endValue={useSeparateEndTz ? endTimezone : null}
            useSeparate={useSeparateEndTz}
            onSave={(start, end) => {
              setTimezone(start);
              setUseSeparateEndTz(end != null);
              if (end != null) setEndTimezone(end);
            }}
          />

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
            <button
              type="submit"
              className="submit-btn"
              disabled={!name.trim() || (isLodgingType && startDayId === endDayId)}
            >
              <span key={submitLabel} className="submit-btn-label">
                {submitLabel}
              </span>
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

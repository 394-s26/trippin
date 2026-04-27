import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MapGL, { Marker, Popup, MapRef } from 'react-map-gl/mapbox';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// import MapFilterPanel from '../components/MapFilterPanel';
import MiniTripBanner from '../components/MiniTripBanner';
import DirectionsExplorer from '../components/DirectionsExplorer';
import useTrip from '../hooks/useTrip';
import { useDays } from '../hooks/useDays';
import useItinerary from '../hooks/useItinerary';
import useMapLoadLimit from '../hooks/useMapLoadLimit';
import { useAuth } from '../contexts/AuthContext';
import { Event, EventCategory, EVENT_CATEGORY } from '../types/event';
import { EVENT_TYPE_ICONS } from '../services/eventSvgIcons';
import { EVENT_COLORS } from '../utilities/eventColors';
import './MapPage.css';
import { CaretRightIcon } from '../services/svgIcons';

const ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? '';
const ALL_CATEGORIES: EventCategory[] = ['Transportation', 'Lodging', 'Activity', 'Attraction', 'Food & Drink'];

const hasCoords = (e: Event): e is Event & { lat: number; lng: number } =>
  typeof e.lat === 'number' && typeof e.lng === 'number';

const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
};

const formatDayLabel = (date: Date): string => {
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  return `${month} ${ordinal(date.getDate())}`;
};

const PopupContent = ({ event }: { event: Event }) => {
  const date =
    event.startDate instanceof Date
      ? event.startDate.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : '';
  return (
    <div className="map-popup">
      <div className="map-popup-name">{event.name}</div>
      <div className="map-popup-type">{event.type}</div>
      <div className="map-popup-date">{date}</div>
      {event.location && <div className="map-popup-location">{event.location}</div>}
    </div>
  );
};

const EventMarker = ({
  event,
  orderNum,
  color,
  onClick,
}: {
  event: Event & { lat: number; lng: number };
  orderNum: number;
  color: string;
  onClick: () => void;
}) => {
  const Icon = EVENT_TYPE_ICONS[event.type];
  return (
    <Marker
      longitude={event.lng}
      latitude={event.lat}
      anchor="bottom"
      onClick={e => {
        e.originalEvent.stopPropagation();
        onClick();
      }}
    >
      <div className="map-marker">
        <div className="map-marker-pin" style={{ color: color, borderColor: color }}>
          {Icon ? <Icon size={16} /> : <span className="map-marker-initial">{event.name.charAt(0).toUpperCase()}</span>}
          <div className="map-marker-badge" style={{ color, borderColor: color }}>{orderNum}</div>
        </div>
      </div>
    </Marker>
  );
};

const MapPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const tripId = id!;

  const { trip, loading, error, permissionDenied } = useTrip(tripId);
  const { days } = useDays(tripId);
  const { events } = useItinerary(tripId);
  const { count, atLimit, max, increment } = useMapLoadLimit();

  const mapRef = useRef<MapRef>(null);
  const initializedRef = useRef(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Adapter so DirectionsExplorer (which expects mapboxgl.Map) always reads the live instance.
  const mapboxMapRef = useMemo(() => ({
    get current(): mapboxgl.Map | null {
      return mapRef.current?.getMap() ?? null;
    },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // const [filterOpen, setFilterOpen] = useState(false);
  const [showUnmappable, setShowUnmappable] = useState(false);
  const [selectedDayIds, setSelectedDayIds] = useState<Set<string>>(new Set());
  const [selectedCategories] = useState<Set<EventCategory>>(new Set(ALL_CATEGORIES));
  const [nameQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeDayIds, setActiveDayIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (days.length > 0 && selectedDayIds.size === 0) {
      setSelectedDayIds(new Set(days.map(d => d.id)));
    }
    if (days.length > 0 && activeDayIds.size === 0) {
      const today = new Date();
      const todayDay = days.find(d =>
        d.date.getFullYear() === today.getFullYear() &&
        d.date.getMonth() === today.getMonth() &&
        d.date.getDate() === today.getDate(),
      );
      if (todayDay) setActiveDayIds(new Set([todayDay.id]));
    }
  }, [days.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const mappableEvents = useMemo(() => events.filter(hasCoords), [events]);
  const unmappableEvents = useMemo(() => events.filter(e => !hasCoords(e)), [events]);

  const dayColorMap = useMemo(() => {
    const m = new Map<string, string>();
    days.forEach((day, i) => m.set(day.id, EVENT_COLORS[i % EVENT_COLORS.length].hex));
    return m;
  }, [days]);

  const dayNumberMap = useMemo(() => {
    const m = new Map<string, number>();
    days.forEach((day, i) => m.set(day.id, i + 1));
    return m;
  }, [days]);

  const visibleEvents = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    return mappableEvents.filter(e => {
      if (!selectedDayIds.has(e.dayId)) return false;
      const cat = EVENT_CATEGORY[e.type];
      if (cat && cat !== 'None' && !selectedCategories.has(cat)) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [mappableEvents, selectedDayIds, selectedCategories, nameQuery]);

  // Single active day = that day's events are the centering target.
  const singleActiveDayId = activeDayIds.size === 1 ? [...activeDayIds][0] : null;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || visibleEvents.length === 0) return;
    if (singleActiveDayId) return; // focused-day effect handles centering
    const bounds = new mapboxgl.LngLatBounds();
    visibleEvents.forEach(e => bounds.extend([e.lng!, e.lat!]));
    map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 800 });
  }, [visibleEvents, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!singleActiveDayId || !mapLoaded) return;
    const map = mapRef.current;
    if (!map) return;
    const dayEvents = mappableEvents.filter(e => e.dayId === singleActiveDayId);
    if (dayEvents.length === 0) return;
    const bounds = new mapboxgl.LngLatBounds();
    dayEvents.forEach(e => bounds.extend([e.lng, e.lat]));
    map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 800 });
  }, [singleActiveDayId, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // const clearFilters = () => {
  //   setSelectedDayIds(new Set(days.map(d => d.id)));
  //   setSelectedCategories(new Set(ALL_CATEGORIES));
  //   setNameQuery('');
  // };

  const selectedEvent = selectedEventId
    ? (visibleEvents.find(e => e.id === selectedEventId) ?? null)
    : null;

  const handleRecenter = () => {
    const map = mapRef.current;
    if (!map || visibleEvents.length === 0) return;
    const bounds = new mapboxgl.LngLatBounds();
    visibleEvents.forEach(e => bounds.extend([e.lng!, e.lat!]));
    map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 800 });
  };

  const handleDayNavClick = (dayId: string) => {
    // Day nav is single-select: clicking it collapses to just that day,
    // or deselects if it was already the only active day.
    setActiveDayIds(prev =>
      prev.size === 1 && prev.has(dayId) ? new Set() : new Set([dayId]),
    );
  };

  // home-container gives the correct column width; override its min-h-screen so it
  // never exceeds the space available between the fixed header (80px) and navbar (80px).
  const containerStyle: React.CSSProperties = {
    height: 'calc(100dvh - 160px)', // 80px header + 80px navbar
    marginTop: '65px',
    minHeight: 'unset',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  if (loading) {
    return (
      <div className="home-wrapper" style={{ minHeight: 'unset' }}>
        <div className="home-container" style={containerStyle}>
          <div className="map-centered-status">Loading trip…</div>
        </div>
      </div>
    );
  }

  if (permissionDenied || (appUser && trip && appUser.uid !== trip.userId && !trip.shared.includes(appUser.uid))) {
    return (
      <div className="home-wrapper" style={{ minHeight: 'unset' }}>
        <div className="home-container" style={containerStyle}>
          <div className="map-centered-status">
            <p>You do not have permission to view this trip.</p>
            <button className="map-link-btn" onClick={() => navigate('/')}>Go to home</button>
          </div>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="home-wrapper" style={{ minHeight: 'unset' }}>
        <div className="home-container" style={containerStyle}>
          <div className="map-centered-status">
            <p>{error ?? 'Trip not found'}</p>
            <button className="map-link-btn" onClick={() => navigate('/')}>Back to home</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-wrapper" style={{ minHeight: 'unset' }}>
      <div className="home-container" style={containerStyle}>
      {atLimit ? (
        <div className="map-limit-panel">
          <h2>You've reached your map view limit</h2>
          <p>
            You have loaded this map {count} times, which is the per-user cap of {max}.
            Clear your browser storage for this site to reset, or contact the trip owner.
          </p>
          <button className="map-link-btn" onClick={() => navigate(`/trip/${tripId}`)}>
            Back to trip
          </button>
        </div>
      ) : !ACCESS_TOKEN ? (
        <div className="map-limit-panel">
          <h2>Map unavailable</h2>
          <p>
            A Mapbox access token is not configured. Set
            <code> VITE_MAPBOX_ACCESS_TOKEN </code>
            in your <code>.env</code> file and restart the dev server.
          </p>
        </div>
      ) : (
            <div
              className="map-layout"
              style={{ display: 'flex', flexDirection: 'row', width: '100%', flex: '1 1 0', minHeight: '500px' }}
            >
              <div
                className="map-canvas-wrapper"
                style={{ position: 'relative', flex: '1 1 0%', minWidth: 0, height: '100%' }}
              >
                <div className="map-banner-overlay">
                  <MiniTripBanner
                    tripName={trip.name}
                    backgroundImage={trip.bannerImageUrl}
                    ownerId={trip.userId}
                    shared={trip.shared}
                  />
                </div>
                <MapGL
                  ref={mapRef}
                  initialViewState={{ longitude: 0, latitude: 20, zoom: 1.5 }}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                  mapStyle="mapbox://styles/mapbox/streets-v12"
                  mapboxAccessToken={ACCESS_TOKEN}
                  projection="mercator"
                  onLoad={() => {
                    if (!initializedRef.current) {
                      initializedRef.current = true;
                      increment();
                    }
                    setMapLoaded(true);
                  }}
                  onClick={() => setSelectedEventId(null)}
                >
                  {visibleEvents.map(event => (
                    <EventMarker
                      key={event.id}
                      event={event}
                      orderNum={dayNumberMap.get(event.dayId) ?? 1}
                      color={dayColorMap.get(event.dayId) ?? '#2D5A27'}
                      onClick={() => setSelectedEventId(event.id)}
                    />
                  ))}

                  {selectedEvent && (
                    <Popup
                      longitude={selectedEvent.lng!}
                      latitude={selectedEvent.lat!}
                      anchor="top"
                      offset={20}
                      closeButton={false}
                      onClose={() => setSelectedEventId(null)}
                    >
                      <PopupContent event={selectedEvent} />
                    </Popup>
                  )}
                </MapGL>

                {/* <MapFilterPanel
                  isOpen={filterOpen}
                  onToggle={() => setFilterOpen(o => !o)}
                  days={days}
                  selectedDayIds={selectedDayIds}
                  selectedCategories={selectedCategories}
                  nameQuery={nameQuery}
                  onChangeDays={setSelectedDayIds}
                  onChangeCategories={setSelectedCategories}
                  onChangeNameQuery={setNameQuery}
                  onClose={() => setFilterOpen(false)}
                  onClearAll={clearFilters}
                /> */}

                {days.length > 0 && (
                  <div className="map-day-nav">
                    <p className="map-day-nav--title">Daily Plan</p>
                    <div className="map-day-nav--buttons">
                      {days.map(day => {
                        const dateLabel = formatDayLabel(day.date);
                        const isActive = activeDayIds.size === 1 && activeDayIds.has(day.id);
                        return (
                          <button
                            key={day.id}
                            type="button"
                            className={`map-day-nav-btn${isActive ? ' map-day-nav-btn--active' : ''}`}
                            onClick={() => handleDayNavClick(day.id)}
                            aria-pressed={isActive}
                          >
                            {dateLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="map-top-right-controls">
                  {/* <div className="map-load-meter" aria-live="polite">
                    {remaining} map views left
                  </div> */}
                  <button
                    className="map-recenter-btn"
                    onClick={handleRecenter}
                    title="Re-center on events"
                    aria-label="Re-center map on visible events"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"/>
                      <line x1="12" y1="2" x2="12" y2="6"/>
                      <line x1="12" y1="18" x2="12" y2="22"/>
                      <line x1="2" y1="12" x2="6" y2="12"/>
                      <line x1="18" y1="12" x2="22" y2="12"/>
                    </svg>
                    Re-center
                  </button>
                </div>



                <DirectionsExplorer
                  days={days}
                  mappableEvents={mappableEvents}
                  mapRef={mapboxMapRef}
                  accessToken={ACCESS_TOKEN}
                  activeDayIds={activeDayIds}
                  onChangeActiveDayIds={setActiveDayIds}
                />

                {unmappableEvents.length > 0 && (
                  <div className="map-unmappable">
                    {showUnmappable && (
                      <ul>
                        {unmappableEvents.map(e => (
                          <li key={e.id}>
                            <span className="map-unmappable-name">{e.name}</span>
                            <span className="map-unmappable-hint">
                              {e.location ? `"${e.location}" — no coordinates` : 'No location'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button className="map-unmappable-toggle" onClick={() => setShowUnmappable(!showUnmappable)}>
                      <CaretRightIcon size={16} className={`map-unmappable-caret ${showUnmappable ? 'is-open' : ''}`} />
                      <span>{unmappableEvents.length} event{unmappableEvents.length === 1 ? '' : 's'} without coordinates</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default MapPage;

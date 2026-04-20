import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import AppHeader from '../components/AppHeader';
import MapFilterPanel from '../components/MapFilterPanel';
import DirectionsExplorer from '../components/DirectionsExplorer';
import useTrip from '../hooks/useTrip';
import useDays from '../hooks/useDays';
import useItinerary from '../hooks/useItinerary';
import useMapLoadLimit from '../hooks/useMapLoadLimit';
import { useAuth } from '../contexts/AuthContext';
import { Event, EventCategory, EVENT_CATEGORY } from '../types/event';
import { EVENT_TYPE_ICONS } from '../services/eventSvgIcons';
import './MapPage.css';

const ALL_CATEGORIES: EventCategory[] = ['Transportation', 'Lodging', 'Activity', 'Attraction', 'Food & Drink'];

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? '';

const hasCoords = (e: Event): e is Event & { lat: number; lng: number } =>
  typeof e.lat === 'number' && typeof e.lng === 'number';

const buildMarkerElement = (event: Event, orderNum: number): HTMLDivElement => {
  const Icon = EVENT_TYPE_ICONS[event.type];
  const el = document.createElement('div');
  el.className = 'map-marker';
  el.innerHTML =
    `<div class="map-marker-pin">${Icon ? renderToStaticMarkup(<Icon size={16} />) : ''}</div>` +
    `<div class="map-marker-badge">${orderNum}</div>`;
  return el;
};

const buildPopupHtml = (event: Event): string => {
  const date = event.startDate instanceof Date
    ? event.startDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';
  const loc = event.location ? `<div class="map-popup-location">${event.location.replace(/</g, '&lt;')}</div>` : '';
  const subtype = `<div class="map-popup-type">${event.type}</div>`;
  return `
    <div class="map-popup">
      <div class="map-popup-name">${event.name.replace(/</g, '&lt;')}</div>
      ${subtype}
      <div class="map-popup-date">${date}</div>
      ${loc}
    </div>
  `;
};

const MapPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const tripId = id!;

  const { trip, loading, error, permissionDenied } = useTrip(tripId);
  const { days } = useDays(tripId);
  const { events } = useItinerary(tripId);
  const { count, remaining, atLimit, max, increment } = useMapLoadLimit();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const initializedRef = useRef(false);

  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedDayIds, setSelectedDayIds] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<EventCategory>>(new Set(ALL_CATEGORIES));
const [nameQuery, setNameQuery] = useState('');

  useEffect(() => {
    if (days.length > 0 && selectedDayIds.size === 0) {
      setSelectedDayIds(new Set(days.map(d => d.id)));
    }
  }, [days.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const mappableEvents = useMemo(() => events.filter(hasCoords), [events]);
  const unmappableEvents = useMemo(() => events.filter(e => !hasCoords(e)), [events]);

  // Chronological order of each event within its day (1-based), used for pin badges.
  const eventOrderMap = useMemo(() => {
    const order = new Map<string, number>();
    const byDay = new Map<string, Event[]>();
    events.forEach(e => {
      const arr = byDay.get(e.dayId) ?? [];
      arr.push(e);
      byDay.set(e.dayId, arr);
    });
    byDay.forEach(dayEvents => {
      [...dayEvents]
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
        .forEach((e, i) => order.set(e.id, i + 1));
    });
    return order;
  }, [events]);

  const visibleEvents = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    return mappableEvents.filter(e => {
      if (!selectedDayIds.has(e.dayId)) return false;
      if (!selectedCategories.has(EVENT_CATEGORY[e.type])) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [mappableEvents, selectedDayIds, selectedCategories, nameQuery]);

  // Initialize the map exactly once per mount, and only if the user hasn't hit the limit.
  useEffect(() => {
    if (atLimit) return;
    if (initializedRef.current) return;
    if (!mapContainerRef.current) return;
    if (!mapboxgl.accessToken) return;

    initializedRef.current = true;
    increment();

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [0, 20],
      zoom: 1.5,
    });
    mapRef.current = map;

    map.on('load', () => map.resize());
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      initializedRef.current = false;
    };
  }, [atLimit, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync markers with the filtered event list.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const visibleIds = new Set(visibleEvents.map(e => e.id));

    markersRef.current.forEach((marker, id) => {
      if (!visibleIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    visibleEvents.forEach(event => {
      const orderNum = eventOrderMap.get(event.id) ?? 1;
      const existing = markersRef.current.get(event.id);

      if (existing) {
        // Patch the badge text in-place if the order number changed.
        const badge = existing.getElement().querySelector('.map-marker-badge');
        if (badge && badge.textContent !== String(orderNum)) {
          badge.textContent = String(orderNum);
        }
        return;
      }

      const el = buildMarkerElement(event, orderNum);
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([event.lng!, event.lat!])
        .setPopup(new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(buildPopupHtml(event)))
        .addTo(map);
      markersRef.current.set(event.id, marker);
    });
  }, [visibleEvents, eventOrderMap]);

  // Fit map bounds to visible markers whenever they change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (visibleEvents.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    visibleEvents.forEach(e => bounds.extend([e.lng!, e.lat!]));

    map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 800 });
  }, [visibleEvents]);

  const clearFilters = () => {
    setSelectedDayIds(new Set(days.map(d => d.id)));
    setSelectedCategories(new Set(ALL_CATEGORIES));
    setNameQuery('');
  };

  if (loading) {
    return (
      <div className="home-wrapper">
        <div className="home-container">
          <AppHeader />
          <main className="home-main">
            <div className="map-centered-status">Loading trip…</div>
          </main>
        </div>
      </div>
    );
  }

  if (permissionDenied || (appUser && trip && appUser.uid !== trip.userId && !trip.shared.includes(appUser.uid))) {
    return (
      <div className="home-wrapper">
        <div className="home-container">
          <AppHeader />
          <main className="home-main">
            <div className="map-centered-status">
              <p>You do not have permission to view this trip.</p>
              <button className="map-link-btn" onClick={() => navigate('/')}>Go to home</button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="home-wrapper">
        <div className="home-container">
          <AppHeader />
          <main className="home-main">
            <div className="map-centered-status">
              <p>{error ?? 'Trip not found'}</p>
              <button className="map-link-btn" onClick={() => navigate('/')}>Back to home</button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="home-wrapper">
      <div className="home-container">
        <AppHeader />
        <main className="home-main">
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
          ) : !mapboxgl.accessToken ? (
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
              style={{ display: 'flex', flexDirection: 'row', width: '100%', height: 'calc(100vh - 160px)', minHeight: '500px' }}
            >
              <div
                className="map-canvas-wrapper"
                style={{ position: 'relative', flex: '1 1 0%', minWidth: 0, height: '100%' }}
              >
                <div
                  ref={mapContainerRef}
                  className="map-canvas"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                />

                <MapFilterPanel
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
                />

                <div className="map-load-meter" aria-live="polite">
                  {remaining} map views left
                </div>

                <DirectionsExplorer
                  days={days}
                  mappableEvents={mappableEvents}
                  mapRef={mapRef}
                  accessToken={mapboxgl.accessToken}
                />

                {unmappableEvents.length > 0 && (
                  <details className="map-unmappable">
                    <summary>{unmappableEvents.length} event{unmappableEvents.length === 1 ? '' : 's'} without coordinates</summary>
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
                  </details>
                )}
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default MapPage;

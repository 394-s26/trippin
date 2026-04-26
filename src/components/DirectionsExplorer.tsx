import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

import { Day } from '../types/day';
import { Event } from '../types/event';
import { fetchDirections, DirectionsResult } from '../services/mapboxDirectionsService';
import { RouteIcon, XIcon } from '../services/svgIcons';
import './DirectionsExplorer.css';

const ROUTE_SOURCE_PREFIX = 'directions-route-source';
const ROUTE_LAYER_PREFIX = 'directions-route-layer';
const ROUTE_ARROW_LAYER_PREFIX = 'directions-route-arrow';
const ARROW_IMAGE_ID = 'route-direction-arrow';

const ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="12" height="12"><polygon points="0,0 12,6 0,12 3,6" fill="white"/></svg>`;
const MAX_WAYPOINTS = 25;

const formatDistance = (meters: number): string => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const formatDuration = (seconds: number): string => {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

interface DirectionsExplorerProps {
  days: Omit<Day, 'events'>[];
  mappableEvents: Array<Event & { lat: number; lng: number }>;
  mapRef: { current: mapboxgl.Map | null };
  accessToken: string;
}

const DirectionsExplorer = ({
  days,
  mappableEvents,
  mapRef,
  accessToken,
}: DirectionsExplorerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDayIds, setActiveDayIds] = useState<Set<string>>(new Set());
  const [loadingDayIds, setLoadingDayIds] = useState<Set<string>>(new Set());
  const [routeInfoMap, setRouteInfoMap] = useState<Map<string, { distance: number; duration: number }>>(new Map());
  const [errorMap, setErrorMap] = useState<Map<string, string>>(new Map());

  const routeLabelRefs = useRef<Map<string, mapboxgl.Marker>>(new Map());

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Array<Event & { lat: number; lng: number }>>();
    mappableEvents.forEach(e => {
      const arr = map.get(e.dayId) ?? [];
      arr.push(e);
      map.set(e.dayId, arr);
    });
    map.forEach((evts, dayId) => {
      map.set(dayId, [...evts].sort((a, b) => a.startDate.getTime() - b.startDate.getTime()));
    });
    return map;
  }, [mappableEvents]);

  const qualifyingDays = useMemo(
    () => days.filter(d => (eventsByDay.get(d.id)?.length ?? 0) >= 2),
    [days, eventsByDay],
  );

  const clearDayRoute = useCallback((dayId: string) => {
    const label = routeLabelRefs.current.get(dayId);
    if (label) {
      label.remove();
      routeLabelRefs.current.delete(dayId);
    }
    const map = mapRef.current;
    if (!map) return;
    const layerId = `${ROUTE_LAYER_PREFIX}-${dayId}`;
    const arrowLayerId = `${ROUTE_ARROW_LAYER_PREFIX}-${dayId}`;
    const sourceId = `${ROUTE_SOURCE_PREFIX}-${dayId}`;
    try {
      if (map.getLayer(arrowLayerId)) map.removeLayer(arrowLayerId);
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    } catch {
      // Map may have been removed during cleanup.
    }
  }, [mapRef]);

  const clearAllRoutes = useCallback(() => {
    routeLabelRefs.current.forEach((_, dayId) => clearDayRoute(dayId));
    routeLabelRefs.current.clear();
  }, [clearDayRoute]);

  const drawDayRoute = useCallback((
    map: mapboxgl.Map,
    dayId: string,
    geometry: DirectionsResult['geometry'],
    distance: number,
    duration: number,
  ) => {
    clearDayRoute(dayId);

    const sourceId = `${ROUTE_SOURCE_PREFIX}-${dayId}`;
    const layerId = `${ROUTE_LAYER_PREFIX}-${dayId}`;

    map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry },
    });

    const lineLayer: mapboxgl.LineLayer = {
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#2D5A27', 'line-width': 5, 'line-opacity': 0.85 },
    };
    map.addLayer(lineLayer);

    const arrowLayerId = `${ROUTE_ARROW_LAYER_PREFIX}-${dayId}`;
    const addArrowLayer = () => {
      if (map.getLayer(arrowLayerId)) return;
      map.addLayer({
        id: arrowLayerId,
        type: 'symbol',
        source: sourceId,
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 80,
          'icon-image': ARROW_IMAGE_ID,
          'icon-size': 1,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          'icon-color': '#2D5A27',
          'icon-halo-color': 'white',
          'icon-halo-width': 1,
        },
      });
    };

    if (map.hasImage(ARROW_IMAGE_ID)) {
      addArrowLayer();
    } else {
      const img = new Image(12, 12);
      img.onload = () => {
        if (!map.hasImage(ARROW_IMAGE_ID)) map.addImage(ARROW_IMAGE_ID, img, { sdf: true });
        addArrowLayer();
      };
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ARROW_SVG)}`;
    }

    const coords = geometry.coordinates;
    const [midLng, midLat] = coords[Math.floor(coords.length / 2)];
    const el = document.createElement('div');
    el.className = 'directions-route-pill';
    el.innerHTML =
      `<span>${formatDistance(distance)}</span>` +
      `<span class="directions-route-pill-sep">·</span>` +
      `<span>${formatDuration(duration)}</span>`;

    routeLabelRefs.current.set(
      dayId,
      new mapboxgl.Marker({ element: el, anchor: 'bottom-left' })
        .setLngLat([midLng, midLat])
        .addTo(map),
    );
  }, [clearDayRoute]);

  // Fetch and draw routes for all active days whenever the selection changes.
  useEffect(() => {
    if (activeDayIds.size === 0) {
      clearAllRoutes();
      setRouteInfoMap(new Map());
      return;
    }

    let cancelled = false;

    clearAllRoutes();
    setErrorMap(new Map());
    setLoadingDayIds(new Set(
      [...activeDayIds].filter(id => (eventsByDay.get(id)?.length ?? 0) >= 2),
    ));

    [...activeDayIds].forEach(dayId => {
      const dayEvents = eventsByDay.get(dayId);
      if (!dayEvents || dayEvents.length < 2) return;

      const waypoints: [number, number][] = dayEvents
        .slice(0, MAX_WAYPOINTS)
        .map(e => [e.lng, e.lat]);

      fetchDirections(waypoints, 'driving', accessToken)
        .then(result => {
          if (cancelled) return;
          const map = mapRef.current;
          if (!map) return;

          const apply = () => {
            if (cancelled) return;
            drawDayRoute(map, dayId, result.geometry, result.distance, result.duration);

            const coords = result.geometry.coordinates;
            if (coords.length > 0) {
              const bounds = new mapboxgl.LngLatBounds();
              coords.forEach(([lng, lat]) => bounds.extend([lng, lat] as [number, number]));
              map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 800 });
            }

            setRouteInfoMap(prev => new Map(prev).set(dayId, { distance: result.distance, duration: result.duration }));
            setLoadingDayIds(prev => { const s = new Set(prev); s.delete(dayId); return s; });
          };

          if (!map.isStyleLoaded()) {
            map.once('style.load', apply);
          } else {
            apply();
          }
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          const msg = (err instanceof Error ? err.message : null) ?? 'Failed to fetch directions';
          setErrorMap(prev => new Map(prev).set(dayId, msg));
          setLoadingDayIds(prev => { const s = new Set(prev); s.delete(dayId); return s; });
        });
    });

    return () => {
      cancelled = true;
      clearAllRoutes();
    };
  }, [activeDayIds, eventsByDay, accessToken, mapRef, clearAllRoutes, drawDayRoute]);

  const handleDayClick = (dayId: string) => {
    setActiveDayIds(prev => {
      const s = new Set(prev);
      s.has(dayId) ? s.delete(dayId) : s.add(dayId);
      return s;
    });
    setErrorMap(prev => { const m = new Map(prev); m.delete(dayId); return m; });
  };

  return (
    <div className={`directions-explorer${isOpen ? ' directions-explorer--open' : ''}`}>
      <div className="directions-explorer-card">
        <div className="directions-explorer-header">
          <h2 className="directions-explorer-title">Directions Explorer</h2>
          <button
            type="button"
            className="directions-explorer-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close directions explorer"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="directions-explorer-body">
          {qualifyingDays.length === 0 ? (
            <p className="directions-explorer-empty">
              No days have 2 or more mappable events.
            </p>
          ) : (
            <ul className="directions-day-list">
              {qualifyingDays.map(day => {
                const dayEvents = eventsByDay.get(day.id) ?? [];
                const isActive = activeDayIds.has(day.id);
                const isLoading = loadingDayIds.has(day.id);
                const routeInfo = routeInfoMap.get(day.id) ?? null;
                const error = errorMap.get(day.id) ?? null;
                const dateLabel = day.date.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });
                const stopCount = Math.min(dayEvents.length, MAX_WAYPOINTS);

                return (
                  <li key={day.id}>
                    <button
                      type="button"
                      className={`directions-day-btn${isActive ? ' directions-day-btn--active' : ''}`}
                      onClick={() => handleDayClick(day.id)}
                      aria-pressed={isActive}
                    >
                      <div className="directions-day-info">
                        <span className="directions-day-label">{day.label || dateLabel}</span>
                        <span className="directions-day-meta">
                          {dateLabel} · {stopCount} stop{stopCount !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {isActive && isLoading && (
                        <span className="directions-spinner" aria-label="Loading route…" />
                      )}

                      {isActive && !isLoading && routeInfo && (
                        <div className="directions-route-badge">
                          <span>{formatDistance(routeInfo.distance)}</span>
                          <span>{formatDuration(routeInfo.duration)}</span>
                        </div>
                      )}
                    </button>

                    {isActive && error && (
                      <p className="directions-error">{error}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <button
        type="button"
        className={`directions-explorer-toggle${isOpen ? ' directions-explorer-toggle--active' : ''}`}
        onClick={() => setIsOpen(o => !o)}
        aria-label="Toggle directions explorer"
        aria-expanded={isOpen}
      >
        <RouteIcon size={18} />
        <span>Directions</span>
      </button>
    </div>
  );
};

export default DirectionsExplorer;

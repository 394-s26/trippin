import { useCallback, useEffect, useMemo, useState } from 'react';
import mapboxgl from 'mapbox-gl';

import { Day } from '../types/day';
import { Event } from '../types/event';
import { fetchDirections } from '../services/mapboxDirectionsService';
import { RouteIcon, XIcon } from '../services/svgIcons';
import './DirectionsExplorer.css';

const ROUTE_SOURCE_ID = 'directions-route-source';
const ROUTE_LAYER_ID = 'directions-route-layer';
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
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);

  // Group mappable events by dayId, each list sorted by startDate ascending.
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

  // Only days that have at least 2 events with coordinates qualify.
  const qualifyingDays = useMemo(
    () => days.filter(d => (eventsByDay.get(d.id)?.length ?? 0) >= 2),
    [days, eventsByDay],
  );

  const clearRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
      if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
    } catch {
      // Map may have already been removed during cleanup.
    }
  }, [mapRef]);

  // Fetch and draw the route whenever the active day changes.
  useEffect(() => {
    if (!activeDayId) {
      clearRoute();
      setRouteInfo(null);
      return;
    }

    const dayEvents = eventsByDay.get(activeDayId);
    if (!dayEvents || dayEvents.length < 2) {
      clearRoute();
      return;
    }

    const waypoints: [number, number][] = dayEvents
      .slice(0, MAX_WAYPOINTS)
      .map(e => [e.lng, e.lat]);

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchDirections(waypoints, 'driving', accessToken)
      .then(result => {
        if (cancelled) return;
        const map = mapRef.current;
        if (!map) return;

        clearRoute();

        map.addSource(ROUTE_SOURCE_ID, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: result.geometry,
          },
        });

        // Insert the route line beneath the map's text label layers so it
        // doesn't obscure place names.
        const layers = (map.getStyle()?.layers ?? []) as mapboxgl.AnyLayer[];
        const firstSymbolId = layers.find(l => l.type === 'symbol')?.id;

        const layerSpec = {
          id: ROUTE_LAYER_ID,
          type: 'line' as const,
          source: ROUTE_SOURCE_ID,
          layout: { 'line-join': 'round' as const, 'line-cap': 'round' as const },
          paint: {
            'line-color': '#2D5A27',
            'line-width': 4,
            'line-opacity': 0.85,
          },
        };

        try {
          map.addLayer(layerSpec, firstSymbolId);
        } catch {
          map.addLayer(layerSpec);
        }

        setRouteInfo({ distance: result.distance, duration: result.duration });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError((err instanceof Error ? err.message : null) ?? 'Failed to fetch directions');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      clearRoute();
    };
  }, [activeDayId, eventsByDay, accessToken, mapRef, clearRoute]);

  // Deselect the active day and clear the route when the panel is closed.
  useEffect(() => {
    if (!isOpen) {
      setActiveDayId(null);
      setError(null);
    }
  }, [isOpen]);

  const handleDayClick = (dayId: string) => {
    setActiveDayId(prev => (prev === dayId ? null : dayId));
    setError(null);
  };

  return (
    <div className={`directions-explorer${isOpen ? ' directions-explorer--open' : ''}`}>
      <div className="directions-explorer-inner">
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
                const isActive = activeDayId === day.id;
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

                      {isActive && loading && (
                        <span className="directions-spinner" aria-label="Loading route…" />
                      )}

                      {isActive && !loading && routeInfo && (
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

        <div className="directions-explorer-footer">
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
      </div>
    </div>
  );
};

export default DirectionsExplorer;

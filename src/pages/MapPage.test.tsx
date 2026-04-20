import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Event } from '../types/event';

const mapCtor = vi.fn();
const fitBoundsFn = vi.fn();
const removeFn = vi.fn();
const markerRemoveFn = vi.fn();

vi.mock('mapbox-gl', () => {
  class Map {
    constructor(...args: unknown[]) {
      mapCtor(...args);
    }
    remove = removeFn;
    fitBounds = fitBoundsFn;
    on = vi.fn();
    resize = vi.fn();
  }
  class Marker {
    setLngLat() { return this; }
    setPopup() { return this; }
    addTo() { return this; }
    remove = markerRemoveFn;
  }
  class Popup {
    setHTML() { return this; }
  }
  class LngLatBounds {
    extend() { return this; }
  }
  return {
    default: { Map, Marker, Popup, LngLatBounds, accessToken: '' },
    Map,
    Marker,
    Popup,
    LngLatBounds,
    accessToken: '',
  };
});

vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}));

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver;

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    appUser: { uid: 'user-1', email: 'u@test', firstName: 'U', lastName: 'Ser', username: 'u', photoURL: null },
  }),
}));

vi.mock('../components/AppHeader', () => ({
  default: () => <div data-testid="app-header" />,
}));

const useTripMock = vi.fn();
const useDaysMock = vi.fn();
const useItineraryMock = vi.fn();
const useMapLoadLimitMock = vi.fn();

vi.mock('../hooks/useTrip', () => ({ default: () => useTripMock() }));
vi.mock('../hooks/useDays', () => ({ default: () => useDaysMock() }));
vi.mock('../hooks/useItinerary', () => ({ default: () => useItineraryMock() }));
vi.mock('../hooks/useMapLoadLimit', () => ({ default: () => useMapLoadLimitMock() }));

import mapboxgl from 'mapbox-gl';
import MapPage from './MapPage';

const makeEvent = (overrides: Partial<Event>): Event => ({
  id: 'e1',
  tripId: 't1',
  dayId: 'd1',
  name: 'Event',
  type: 'Hiking',
  startDate: new Date('2026-05-01T10:00:00'),
  ...overrides,
} as Event);

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/trip/t1/map']}>
      <Routes>
        <Route path="/trip/:id/map" element={<MapPage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mapCtor.mockClear();
  fitBoundsFn.mockClear();
  removeFn.mockClear();
  markerRemoveFn.mockClear();

  useTripMock.mockReturnValue({
    trip: { id: 't1', userId: 'user-1', name: 'Trip', startDate: new Date(), endDate: new Date(), budget: 0, bannerImageUrl: null, shared: [], permissions: {} },
    loading: false,
    error: null,
    permissionDenied: false,
    can: () => true,
  });
  useDaysMock.mockReturnValue({
    days: [{ id: 'd1', tripId: 't1', date: new Date('2026-05-01'), label: 'Day 1' }],
    addDay: vi.fn(),
    renameDayLabel: vi.fn(),
    removeDay: vi.fn(),
    changeStartDate: vi.fn(),
  });
  useItineraryMock.mockReturnValue({
    events: [
      makeEvent({ id: 'e1', name: 'Mappable', lat: 37.77, lng: -122.41 }),
      makeEvent({ id: 'e2', name: 'Unmappable', location: 'Somewhere' }),
    ],
    loading: false,
    error: null,
  });
  useMapLoadLimitMock.mockReturnValue({
    count: 0,
    remaining: 200,
    atLimit: false,
    max: 200,
    increment: vi.fn(),
  });
});

describe('MapPage', () => {
  it('renders the at-limit panel and does not construct a Mapbox Map when atLimit is true', () => {
    useMapLoadLimitMock.mockReturnValue({
      count: 200,
      remaining: 0,
      atLimit: true,
      max: 200,
      increment: vi.fn(),
    });

    renderPage();

    expect(screen.getByText(/reached your map view limit/i)).toBeInTheDocument();
    expect(mapCtor).not.toHaveBeenCalled();
  });

  it('renders the missing-token notice when no Mapbox token is set', () => {
    (mapboxgl as unknown as { accessToken: string }).accessToken = '';
    renderPage();
    expect(screen.getByText(/Map unavailable/i)).toBeInTheDocument();
    expect(mapCtor).not.toHaveBeenCalled();
  });

  it('lists events without coordinates in the unmappable panel', () => {
    (mapboxgl as unknown as { accessToken: string }).accessToken = 'pk.test';
    renderPage();
    expect(screen.getByText(/1 event without coordinates/i)).toBeInTheDocument();
    expect(screen.getByText('Unmappable')).toBeInTheDocument();
  });
});

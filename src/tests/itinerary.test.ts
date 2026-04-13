import { describe, expect, it } from 'vitest';
import { Day } from '../types/day';
import { Event } from '../types/event';
import { buildItineraryDays, findDayIdForDate } from '../utilities/itinerary';

const makeDay = (id: string, date: Date): Omit<Day, 'events'> => ({
  id,
  tripId: 'trip-1',
  date,
  label: date.toLocaleDateString('en-US', { weekday: 'long' }),
});

const makeEvent = (overrides: Partial<Event>): Event => ({
  id: overrides.id ?? 'event-1',
  tripId: 'trip-1',
  dayId: overrides.dayId ?? 'day-1',
  type: overrides.type ?? 'Activity',
  name: overrides.name ?? 'Event',
  startDate: overrides.startDate ?? new Date(2026, 3, 12, 9, 0),
  endDate: overrides.endDate ?? null,
  location: overrides.location,
  timezone: overrides.timezone,
  cost: overrides.cost,
  paidBy: overrides.paidBy,
});

describe('buildItineraryDays', () => {
  it('adds hotel continuation rows on covered trip days after check-in', () => {
    const days = [
      makeDay('day-1', new Date(2026, 3, 12, 0, 0)),
      makeDay('day-2', new Date(2026, 3, 13, 0, 0)),
      makeDay('day-3', new Date(2026, 3, 14, 0, 0)),
    ];

    const hotel = makeEvent({
      id: 'hotel-1',
      type: 'Hotel',
      name: 'Lakeside Inn',
      dayId: 'day-1',
      startDate: new Date(2026, 3, 12, 12, 0),
      endDate: new Date(2026, 3, 14, 12, 0),
    });

    const activity = makeEvent({
      id: 'activity-1',
      dayId: 'day-2',
      name: 'Museum',
      startDate: new Date(2026, 3, 13, 10, 0),
    });

    const itineraryDays = buildItineraryDays(days, [hotel, activity]);

    expect(itineraryDays[0].events.map(event => event.variant)).toEqual(['default']);
    expect(itineraryDays[1].events.map(event => event.variant)).toEqual(['hotel-continuation', 'default']);
    expect(itineraryDays[2].events.map(event => event.variant)).toEqual(['hotel-continuation']);
    expect(itineraryDays[2].events[0].event.id).toBe('hotel-1');
  });
});

describe('findDayIdForDate', () => {
  it('matches a day by calendar date rather than exact timestamp', () => {
    const days = [
      makeDay('day-1', new Date(2026, 3, 12, 0, 0)),
      makeDay('day-2', new Date(2026, 3, 13, 0, 0)),
    ];

    expect(findDayIdForDate(days, new Date(2026, 3, 13, 18, 30))).toBe('day-2');
  });
});

import { Day } from '../types/day';
import { Event } from '../types/event';
import { ItineraryDay, ItineraryEventItem } from '../types/itinerary';

const atStartOfDay = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

export const isSameCalendarDay = (left: Date, right: Date): boolean =>
  atStartOfDay(left).getTime() === atStartOfDay(right).getTime();

const compareByStartDate = (left: Event, right: Event): number =>
  new Date(left.startDate).getTime() - new Date(right.startDate).getTime();

const coversDay = (event: Event, dayDate: Date): boolean => {
  if (event.type !== 'Hotel' || !event.endDate) return false;

  const start = atStartOfDay(event.startDate);
  const end = atStartOfDay(event.endDate);
  const current = atStartOfDay(dayDate);

  return current.getTime() > start.getTime() && current.getTime() <= end.getTime();
};

export const findDayIdForDate = (days: Omit<Day, 'events'>[], date: Date): string | null => {
  const match = days.find(day => isSameCalendarDay(day.date, date));
  return match?.id ?? null;
};

export const buildItineraryDays = (
  days: Omit<Day, 'events'>[],
  events: Event[],
): ItineraryDay[] => {
  const sortedEvents = [...events].sort(compareByStartDate);

  return days.map(day => {
    const hotelContinuations: ItineraryEventItem[] = sortedEvents
      .filter(event => coversDay(event, day.date))
      .map(event => ({ event, variant: 'hotel-continuation' }));

    const dayEvents: ItineraryEventItem[] = sortedEvents
      .filter(event => event.dayId === day.id)
      .map(event => ({ event, variant: 'default' }));

    return {
      ...day,
      events: [...hotelContinuations, ...dayEvents],
    };
  });
};

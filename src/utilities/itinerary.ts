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

const coversDay = (event: Event, dayDate: Date): boolean => {
  if (event.type !== 'Hotel' || !event.endDate) return false;

  const start = atStartOfDay(event.startDate);
  const end = atStartOfDay(event.endDate);
  const current = atStartOfDay(dayDate);

  return current.getTime() >= start.getTime() && current.getTime() <= end.getTime();
};

const isCheckoutDay = (event: Event, dayDate: Date): boolean => {
  if (event.type !== 'Hotel' || !event.endDate) return false;
  if (isSameCalendarDay(event.startDate, event.endDate)) return false;
  return isSameCalendarDay(event.endDate, dayDate);
};

export const findDayIdForDate = (days: Omit<Day, 'events'>[], date: Date): string | null => {
  const match = days.find(day => isSameCalendarDay(day.date, date));
  return match?.id ?? null;
};

export const buildItineraryDays = (
  days: Omit<Day, 'events'>[],
  events: Event[],
): ItineraryDay[] => {
  return days.map(day => {
    const continuations: ItineraryEventItem[] = events
      .filter(event => coversDay(event, day.date))
      .map(event => ({ event, variant: 'hotel-continuation' }));

    const defaultItems: { item: ItineraryEventItem; time: number }[] = events
      .filter(event => event.dayId === day.id)
      .map(event => ({
        item: { event, variant: 'default' },
        time: new Date(event.startDate).getTime(),
      }));

    const checkoutItems: { item: ItineraryEventItem; time: number }[] = events
      .filter(event => isCheckoutDay(event, day.date))
      .map(event => ({
        item: { event, variant: 'hotel-checkout' },
        time: new Date(event.endDate!).getTime(),
      }));

    const timed = [...defaultItems, ...checkoutItems].sort((a, b) => a.time - b.time);

    return {
      ...day,
      events: [...continuations, ...timed.map(entry => entry.item)],
    };
  });
};

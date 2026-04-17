import { Event } from '../types/event';

interface DayLike {
  date: Date;
}

const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

export const eventOverlapsDay = (event: Event, day: DayLike): boolean => {
  const start = event.startDate;
  const end = event.endDate ?? event.startDate;
  const dayStart = startOfDay(day.date);
  const dayEnd = endOfDay(day.date);
  return start <= dayEnd && end >= dayStart;
};

export interface EventDaySlice {
  // Time bounds clamped to the day window.
  sliceStart: Date;
  sliceEnd: Date;
  // Position of this day within the event's overall span.
  dayIndex: number; // 1-based
  totalDays: number;
  isAllDay: boolean; // true when the event covers the full day window
}

const sameCalendarDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const daysBetween = (a: Date, b: Date): number => {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
};

export const sliceEventForDay = (event: Event, day: DayLike): EventDaySlice | null => {
  if (!eventOverlapsDay(event, day)) return null;
  const start = event.startDate;
  const end = event.endDate ?? event.startDate;
  const dayStart = startOfDay(day.date);
  const dayEnd = endOfDay(day.date);

  const sliceStart = start > dayStart ? start : dayStart;
  const sliceEnd = end < dayEnd ? end : dayEnd;

  const totalDays = daysBetween(start, end) + 1;
  const dayIndex = daysBetween(start, day.date) + 1;

  // All-day for this slice when the event fully covers this calendar day,
  // i.e. neither side is the event's own start/end day OR the original event
  // already spans the full day.
  const startsBeforeToday = !sameCalendarDay(start, day.date);
  const endsAfterToday = !sameCalendarDay(end, day.date);
  // Explicit allDay flag overrides — every overlapping day shows "All day".
  const isAllDay = event.allDay === true || (startsBeforeToday && endsAfterToday);

  return { sliceStart, sliceEnd, dayIndex, totalDays, isAllDay };
};

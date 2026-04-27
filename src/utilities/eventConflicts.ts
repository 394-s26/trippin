import { Event } from '../types/event';

interface EventRange {
  startMs: number;
  endExclusiveMs: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_EVENT_MS = 15 * 60 * 1000;

type TimestampLike = {
  toDate?: () => Date;
  toMillis?: () => number;
  seconds?: number;
  nanoseconds?: number;
};

const toMs = (value: Date | TimestampLike | string | number | null | undefined): number | null => {
  if (!value) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') {
      const ms = value.toMillis();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof value.toDate === 'function') {
      const ms = value.toDate().getTime();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof value.seconds === 'number') {
      const nanos = typeof value.nanoseconds === 'number' ? value.nanoseconds : 0;
      const ms = value.seconds * 1000 + Math.floor(nanos / 1_000_000);
      return Number.isFinite(ms) ? ms : null;
    }
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  return null;
};

// Create-suggestions occupy real time slots and should surface conflicts.
// Delete-suggestions are proposals about existing events, not new time blocks.
const isConflictEligible = (event: Event): boolean =>
  !event.suggestion || event.suggestion.type === 'create';

const toRange = (event: Event): EventRange | null => {
  const startMs = toMs(event.startDate);
  if (startMs == null) return null;
  const endMsRaw = toMs(event.endDate ?? event.startDate) ?? startMs;

  if (event.allDay) {
    const endExclusiveMs = endMsRaw >= startMs ? endMsRaw + DAY_MS : startMs + DAY_MS;
    return { startMs, endExclusiveMs };
  }

  const endExclusiveMs = endMsRaw > startMs ? endMsRaw : startMs + MIN_EVENT_MS;
  return { startMs, endExclusiveMs };
};

export const eventsConflict = (a: Event, b: Event): boolean => {
  if (a.id === b.id) return false;
  if (!isConflictEligible(a) || !isConflictEligible(b)) return false;
  const ra = toRange(a);
  const rb = toRange(b);
  if (!ra || !rb) return false;
  return ra.startMs < rb.endExclusiveMs && rb.startMs < ra.endExclusiveMs;
};

export const buildConflictMap = (events: Event[]): Map<string, string[]> => {
  const map = new Map<string, Set<string>>();
  const eligible = events.filter(isConflictEligible);
  for (const event of eligible) map.set(event.id, new Set<string>());

  for (let i = 0; i < eligible.length; i += 1) {
    for (let j = i + 1; j < eligible.length; j += 1) {
      const a = eligible[i];
      const b = eligible[j];
      if (!eventsConflict(a, b)) continue;
      map.get(a.id)?.add(b.id);
      map.get(b.id)?.add(a.id);
    }
  }

  const finalized = new Map<string, string[]>();
  for (const [id, peers] of map.entries()) {
    finalized.set(id, Array.from(peers).sort());
  }
  return finalized;
};

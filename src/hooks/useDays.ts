import { useState, useEffect, useRef, useCallback } from 'react';
import { Day } from '../types/day';
import { Trip } from '../types/trip';
import {
  createDay,
  updateDayDate,
  deleteDaysBatch,
  subscribeToDays,
} from '../services/firestoreDayService';
import { canPerformAction } from '../services/permissionService';
import { useAuth } from '../contexts/AuthContext';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type UseDaysOptions = {
  /** When set, creates day documents from trip start/end once the days listener
   * has received its first successful snapshot and the subcollection is still empty. */
  seedWithTrip?: Trip | null;
};

const useDays = (tripId: string, options: UseDaysOptions = {}) => {
  const { seedWithTrip = null } = options;
  const { appUser } = useAuth();
  const uid = appUser?.uid ?? '';

  const [days, setDays] = useState<Omit<Day, 'events'>[]>([]);
  const [hasInitialDaySnapshot, setHasInitialDaySnapshot] = useState(false);
  const hasSeededFromTrip = useRef(false);

  // Used only for initial seeding of an empty subcollection.
  // Removes days from the end if the trip shortened, shifts all remaining days
  // to the new start, then adds days at the end if the trip lengthened.
  const adjustTripLength = useCallback(
    async (newStartDate: Date, newEndDate: Date): Promise<void> => {
      if (!uid) return;
      const newDayCount = Math.max(1, Math.round((newEndDate.getTime() - newStartDate.getTime()) / MS_PER_DAY) + 1);
      const sorted = [...days].sort((a, b) => a.date.getTime() - b.date.getTime());

      const daysToRemove = sorted.slice(newDayCount);
      const daysToKeep = sorted.slice(0, newDayCount);

      if (daysToRemove.length > 0) {
        await deleteDaysBatch(uid, tripId, daysToRemove.map(d => d.id));
      }

      await Promise.all(
        daysToKeep.map((day, i) => {
          const shifted = new Date(newStartDate);
          shifted.setDate(shifted.getDate() + i);
          return updateDayDate(uid, tripId, day.id, shifted);
        })
      );

      for (let i = daysToKeep.length; i < newDayCount; i++) {
        const newDate = new Date(newStartDate);
        newDate.setDate(newDate.getDate() + i);
        const label = newDate.toLocaleDateString('en-US', { weekday: 'long' });
        await createDay(uid, tripId, newDate, label);
      }
    },
    [uid, tripId, days]
  );

  // Used for user-initiated date changes. Preserves existing day documents at
  // their calendar dates — creates days for new dates in range, deletes days
  // that fall outside the new range. Moving start earlier adds days at the
  // front; moving it later removes days from the front.
  const syncDaysToRange = useCallback(
    async (startDate: Date, endDate: Date): Promise<void> => {
      if (!uid) return;
      const normalizedStart = new Date(startDate);
      normalizedStart.setHours(0, 0, 0, 0);
      const normalizedEnd = new Date(endDate);
      normalizedEnd.setHours(0, 0, 0, 0);
      if (normalizedEnd < normalizedStart) return;

      const targetDates: Date[] = [];
      const cursor = new Date(normalizedStart);
      while (cursor <= normalizedEnd) {
        targetDates.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }

      const isSameCalendarDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();

      const sortedDays = [...days].sort((a, b) => a.date.getTime() - b.date.getTime());
      const dayMatchesTarget = (dayDate: Date) => targetDates.some((targetDate) => isSameCalendarDay(dayDate, targetDate));

      const createMissing = targetDates
        .filter((targetDate) => !sortedDays.some((day) => isSameCalendarDay(day.date, targetDate)))
        .map((targetDate) => {
          const label = targetDate.toLocaleDateString('en-US', { weekday: 'long' });
          return createDay(uid, tripId, targetDate, label);
        });

      const deleteOverflow = sortedDays
        .filter((day) => !dayMatchesTarget(day.date))
        .map((day) => deleteDaysBatch(uid, tripId, [day.id]));

      await Promise.all([...createMissing, ...deleteOverflow]);
    },
    [uid, tripId, days]
  );

  useEffect(() => {
    hasSeededFromTrip.current = false;
    setHasInitialDaySnapshot(false);
  }, [tripId]);

  useEffect(() => {
    if (!uid) {
      setDays([]);
      setHasInitialDaySnapshot(false);
      return;
    }
    return subscribeToDays(tripId, (dayList) => {
      setDays(dayList);
      setHasInitialDaySnapshot(true);
    });
  }, [uid, tripId]);

  useEffect(() => {
    if (!seedWithTrip || !uid || !hasInitialDaySnapshot) return;
    if (hasSeededFromTrip.current) return;
    if (days.length > 0) return;
    if (!canPerformAction(uid, seedWithTrip, 'add_day')) return;
    hasSeededFromTrip.current = true;
    void adjustTripLength(seedWithTrip.startDate, seedWithTrip.endDate).catch((err: unknown) => {
      console.error('[useDays] seeding', tripId, err);
      hasSeededFromTrip.current = false;
    });
  }, [seedWithTrip, uid, hasInitialDaySnapshot, days.length, adjustTripLength, tripId]);

  return { days, syncDaysToRange };
};

export { useDays };

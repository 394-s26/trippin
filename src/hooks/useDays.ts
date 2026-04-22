import { useState, useEffect } from 'react';
import { Day } from '../types/day';
import {
  createDay,
  updateDayDate,
  deleteDaysBatch,
  subscribeToDays,
} from '../services/firestoreDayService';
import { useAuth } from '../contexts/AuthContext';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const useDays = (tripId: string) => {
  const { appUser } = useAuth();
  const uid = appUser?.uid ?? '';

  const [days, setDays] = useState<Omit<Day, 'events'>[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToDays(tripId, setDays);
    return unsubscribe;
  }, [tripId]);

  // Adjusts the days subcollection to match a new date range.
  // Removes days from the end if the trip shortened, shifts all remaining days
  // to the new start, then adds days at the end if the trip lengthened.
  const adjustTripLength = async (newStartDate: Date, newEndDate: Date): Promise<void> => {
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
  };

  return { days, adjustTripLength };
};

export { useDays };

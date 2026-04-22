// Custom hook for managing the days subcollection of a trip.
// Subscribes to trips/{tripId}/days in real-time and exposes add, rename, delete, and date-shift operations.

import { useState, useEffect } from 'react';
import { Day } from '../types/day';
import {
    createDay,
    updateDayLabel as updateLabel,
    updateDayDate,
    deleteDay as deleteDayDoc,
    subscribeToDays,
} from '../services/firestoreDayService';
import { useAuth } from '../contexts/AuthContext';

const useDays = (tripId: string) => {
    const { appUser } = useAuth();
    const uid = appUser?.uid ?? '';

    const [days, setDays] = useState<Omit<Day, 'events'>[]>([]);

    useEffect(() => {
        return subscribeToDays(tripId, setDays);
    }, [tripId]);

    const addDay = async (afterDate: Date): Promise<void> => {
        const nextDate = new Date(afterDate);
        nextDate.setDate(nextDate.getDate() + 1);
        const label = nextDate.toLocaleDateString('en-US', { weekday: 'long' });
        await createDay(uid, tripId, nextDate, label);
    };

    const renameDayLabel = async (dayId: string, label: string): Promise<void> => {
        await updateLabel(uid, tripId, dayId, label);
    };

    const removeDay = async (dayId: string): Promise<void> => {
        await deleteDayDoc(uid, tripId, dayId);
    };

    // Shifts every day's date so that day 0 falls on newStartDate.
    const changeStartDate = async (newStartDate: Date): Promise<void> => {
        await Promise.all(
            days.map((day, i) => {
                const shifted = new Date(newStartDate);
                shifted.setDate(shifted.getDate() + i);
                return updateDayDate(uid, tripId, day.id, shifted);
            })
        );
    };

    const syncDaysToRange = async (startDate: Date, endDate: Date): Promise<void> => {
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
            .map((day) => deleteDayDoc(uid, tripId, day.id));

        await Promise.all([...createMissing, ...deleteOverflow]);
    };

    return { days, addDay, renameDayLabel, removeDay, changeStartDate, syncDaysToRange };
};

export default useDays;

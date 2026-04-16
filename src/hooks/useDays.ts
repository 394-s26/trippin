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
        const msPerDay = 86400000;
        const expectedCount = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1);

        if (expectedCount > days.length) {
            for (let i = days.length; i < expectedCount; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                await createDay(uid, tripId, d, d.toLocaleDateString('en-US', { weekday: 'long' }));
            }
        } else if (expectedCount < days.length) {
            await Promise.all(days.slice(expectedCount).map(d => deleteDayDoc(uid, tripId, d.id)));
        }
    };

    return { days, addDay, renameDayLabel, removeDay, changeStartDate, syncDaysToRange };
};

export default useDays;

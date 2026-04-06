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

const useDays = (tripId: string) => {
    const [days, setDays] = useState<Omit<Day, 'events'>[]>([]);

    useEffect(() => {
        return subscribeToDays(tripId, setDays);
    }, [tripId]);

    const addDay = async (afterDate: Date): Promise<void> => {
        const nextDate = new Date(afterDate);
        nextDate.setDate(nextDate.getDate() + 1);
        const label = nextDate.toLocaleDateString('en-US', { weekday: 'long' });
        await createDay(tripId, nextDate, label);
    };

    const renameDayLabel = async (dayId: string, label: string): Promise<void> => {
        await updateLabel(tripId, dayId, label);
    };

    const removeDay = async (dayId: string): Promise<void> => {
        await deleteDayDoc(tripId, dayId);
    };

    // Shifts every day's date so that day 0 falls on newStartDate.
    const changeStartDate = async (newStartDate: Date): Promise<void> => {
        await Promise.all(
            days.map((day, i) => {
                const shifted = new Date(newStartDate);
                shifted.setDate(shifted.getDate() + i);
                return updateDayDate(tripId, day.id, shifted);
            })
        );
    };

    return { days, addDay, renameDayLabel, removeDay, changeStartDate };
};

export default useDays;

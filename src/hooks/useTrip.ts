// This file contains a custom hook for managing trip-related state, including budget and trip details.

import { useState, useEffect } from 'react';
import { onSnapshot, DocumentSnapshot, FirestoreError, Timestamp } from 'firebase/firestore';
import { firestoreTripService, updateTrip, deleteTrip as deleteTripDoc } from '../services/firestoreTripService';
import { Trip } from '../types/trip';
import { toDate } from '../utilities/timestamps';

const useTrip = (tripId: string) => {
    const [trip, setTrip] = useState<Trip | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [permissionDenied, setPermissionDenied] = useState(false);

    useEffect(() => {
        const unsubscribe = onSnapshot(
            firestoreTripService.getTripRef(tripId),
            (snapshot: DocumentSnapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data() as Trip;
                    setTrip({
                        ...data,
                        startDate: toDate(data.startDate as Date | Timestamp),
                    });
                } else {
                    setError('Trip not found');
                }
                setLoading(false);
            },
            (err: FirestoreError) => {
                if (err.code === 'permission-denied') {
                    setPermissionDenied(true);
                } else {
                    setError(err.message);
                }
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [tripId]);

    const updateBudget = async (newBudget: number) => {
        try {
            await firestoreTripService.updateTripBudget(tripId, newBudget);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const updateTripName = async (name: string) => {
        try {
            await updateTrip(tripId, { name });
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }

    const updateBannerImage = async (bannerImageUrl: string) => {
        try {
            await updateTrip(tripId, { bannerImageUrl });
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const deleteTrip = async () => {
        try {
            await deleteTripDoc(tripId);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    return { trip, loading, error, permissionDenied, updateTripName, updateBudget, updateBannerImage, deleteTrip };
};

export default useTrip;

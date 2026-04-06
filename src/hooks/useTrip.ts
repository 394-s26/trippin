// This file contains a custom hook for managing trip-related state, including budget and trip details.

import { useState, useEffect } from 'react';
import { onSnapshot, DocumentSnapshot, FirestoreError, Timestamp } from 'firebase/firestore';
import { firestoreTripService, updateTrip, deleteTrip as deleteTripDoc } from '../services/firestoreTripService';
import { Trip, SplitMethod } from '../types/trip';
import { toDate } from '../utilities/timestamps';
import { useAuth } from '../contexts/AuthContext';
import { canPerformAction } from '../services/permissionService';
import { TripAction } from '../config/permissions';

const useTrip = (tripId: string) => {
    const { appUser } = useAuth();
    const uid = appUser?.uid ?? '';

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

    // Synchronous permission check — uses the already-loaded trip, no extra Firestore reads.
    const can = (action: TripAction): boolean => {
        if (!trip || !uid) return false;
        return canPerformAction(uid, trip, action);
    };

    const updateBudget = async (newBudget: number) => {
        try {
            await firestoreTripService.updateTripBudget(uid, tripId, newBudget);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const updateTripName = async (name: string) => {
        try {
            await updateTrip(uid, tripId, { name }, 'change_trip_name');
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const updateBannerImage = async (bannerImageUrl: string) => {
        try {
            await updateTrip(uid, tripId, { bannerImageUrl }, 'change_banner');
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const updateSplitMethod = async (splitMethod: SplitMethod) => {
        try {
            await updateTrip(uid, tripId, { splitMethod }, 'change_split_method');
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const deleteTrip = async () => {
        try {
            await deleteTripDoc(uid, tripId);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    return { trip, loading, error, permissionDenied, can, updateTripName, updateBudget, updateSplitMethod, updateBannerImage, deleteTrip };
};

export default useTrip;

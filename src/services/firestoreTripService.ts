// This file contains functions for managing trip data in Firestore, including budget and trip details.
// Trip documents store: id, name, startDate, budget, bannerImageUrl, and days[].
// Events are stored in a separate 'events' collection and matched to days by date.

import { db } from './firebase';
import { Trip, LastViewedTrip } from '../types/trip';
import { Role, TripAction } from '../config/permissions';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, or, where, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore';
import { hasActionPermission, PermissionError } from './permissionService';

export const firestoreTripService = {
    getTripRef: (tripId: string) => doc(db, 'trips', tripId),
    updateTripBudget: async (uid: string, tripId: string, budget: number) => {
        const allowed = await hasActionPermission(uid, tripId, 'change_budget');
        if (!allowed) throw new PermissionError('change_budget');
        await updateDoc(doc(db, 'trips', tripId), { budget });
    },
};

const tripsCollection = collection(db, 'trips');

// Creates a new trip. Seeds permissions with the creator as owner.
export const createTrip = async (uid: string, tripData: Omit<Trip, 'id'>): Promise<string> => {
    try {
        const newDocRef = doc(tripsCollection);
        const trip: Trip = {
            ...tripData,
            id: newDocRef.id,
            permissions: { [uid]: 'owner' },
        };
        await setDoc(newDocRef, trip);
        return newDocRef.id;
    } catch (error) {
        console.error("Error creating trip: ", error);
        throw error;
    }
};

// Updates an existing trip. The action param determines which permission is checked.
export const updateTrip = async (uid: string, tripId: string, tripData: Partial<Trip>, action: TripAction) => {
    const allowed = await hasActionPermission(uid, tripId, action);
    if (!allowed) throw new PermissionError(action);
    try {
        const tripDoc = doc(db, 'trips', tripId);
        await updateDoc(tripDoc, tripData);
    } catch (error) {
        console.error("Error updating trip: ", error);
        throw error;
    }
};

// Deletes a trip document.
export const deleteTrip = async (uid: string, tripId: string) => {
    const allowed = await hasActionPermission(uid, tripId, 'delete_trip');
    if (!allowed) throw new PermissionError('delete_trip');
    try {
        await deleteDoc(doc(db, 'trips', tripId));
    } catch (error) {
        console.error("Error deleting trip: ", error);
        throw error;
    }
};

// Adds members to the trip. Writes to both shared[] and permissions map atomically.
export const inviteMembers = async (actorUid: string, tripId: string, newUids: string[], role: Role) => {
    const allowed = await hasActionPermission(actorUid, tripId, 'invite_member');
    if (!allowed) throw new PermissionError('invite_member');
    const permissionsUpdate = Object.fromEntries(
        newUids.map(uid => [`permissions.${uid}`, role])
    );
    await updateDoc(doc(db, 'trips', tripId), {
        shared: arrayUnion(...newUids),
        ...permissionsUpdate,
    });
};

// Removes a member from the trip. Removes from both shared[] and permissions map.
// Self-removal (actorUid === targetUid) skips the permission check so any member
// can leave a trip regardless of their role.
export const removeMember = async (actorUid: string, tripId: string, targetUid: string) => {
    if (actorUid !== targetUid) {
        const allowed = await hasActionPermission(actorUid, tripId, 'remove_member');
        if (!allowed) throw new PermissionError('remove_member');
    }
    await updateDoc(doc(db, 'trips', tripId), {
        shared: arrayRemove(targetUid),
        [`permissions.${targetUid}`]: deleteField(),
    });
};

// Changes an existing member's role.
export const changeMemberRole = async (actorUid: string, tripId: string, targetUid: string, newRole: Role) => {
    const allowed = await hasActionPermission(actorUid, tripId, 'change_member_role');
    if (!allowed) throw new PermissionError('change_member_role');
    await updateDoc(doc(db, 'trips', tripId), {
        [`permissions.${targetUid}`]: newRole,
    });
};

// Persists the last trip the user viewed to their Firestore profile.
export const updateLastViewedTrip = async (uid: string, data: LastViewedTrip) => {
    try {
        await updateDoc(doc(db, 'users', uid), { lastViewedTrip: data });
    } catch (error) {
        console.error('Error updating last viewed trip:', error);
        throw error;
    }
};

// Removes the lastViewedTrip field from the user's profile when the trip no longer exists.
export const clearLastViewedTrip = async (uid: string) => {
    try {
        await updateDoc(doc(db, 'users', uid), { lastViewedTrip: deleteField() });
    } catch (error) {
        console.error('Error clearing last viewed trip:', error);
    }
};

// Subscribes to the user's profile doc to read lastViewedTrip in real-time.
export const subscribeToLastViewedTrip = (
    uid: string,
    callback: (data: LastViewedTrip | null) => void,
) => {
    return onSnapshot(doc(db, 'users', uid), (snapshot) => {
        const data = snapshot.data();
        callback((data?.lastViewedTrip as LastViewedTrip) ?? null);
    });
};

// Listens for trip updates in real-time.
export const subscribeToTrips = (
    userId: string,
    callback: (trips: Trip[]) => void,
    onError?: (err: Error) => void,
) => {
    const q = query(tripsCollection,
        or(
            where('userId', '==', userId),
            where('shared', 'array-contains', userId)
        )
    );
    return onSnapshot(
        q,
        (snapshot) => {
            const trips: Trip[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip));
            callback(trips);
        },
        (err) => {
            console.error('Trip subscription error:', err);
            onError?.(err);
        },
    );
};

// This file contains functions for managing trip data in Firestore, including budget and trip details.
// Trip documents store: id, name, startDate, budget, bannerImageUrl, and days[].
// Events are stored in a separate 'events' collection and matched to days by date.

import { db } from './firebase';
import { Trip } from '../types/trip';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, or, where } from 'firebase/firestore';

export const firestoreTripService = {
    getTripRef: (tripId: string) => doc(db, 'trips', tripId),
    updateTripBudget: async (tripId: string, budget: number) => {
        await updateDoc(doc(db, 'trips', tripId), { budget });
    },
};

const tripsCollection = collection(db, 'trips');

// Function to create a new trip — pre-generates the Firestore ID so it can be stored on the document.
export const createTrip = async (tripData: Omit<Trip, 'id'>): Promise<string> => {
    try {
        const newDocRef = doc(tripsCollection);
        const trip: Trip = { ...tripData, id: newDocRef.id };
        await setDoc(newDocRef, trip);
        return newDocRef.id;
    } catch (error) {
        console.error("Error creating trip: ", error);
        throw error;
    }
};

// Function to update an existing trip
export const updateTrip = async (tripId: string, tripData: Partial<Trip>) => {
    try {
        const tripDoc = doc(db, 'trips', tripId);
        await updateDoc(tripDoc, tripData);
    } catch (error) {
        console.error("Error updating trip: ", error);
        throw error;
    }
};

// Function to delete a trip document
export const deleteTrip = async (tripId: string) => {
    try {
        await deleteDoc(doc(db, 'trips', tripId));
    } catch (error) {
        console.error("Error deleting trip: ", error);
        throw error;
    }
};

// Function to listen for trip updates in real-time
export const subscribeToTrips = (userId: string, callback: (trips: Trip[]) => void) => {
    const q = query(tripsCollection,
        or(
            where('userId', '==', userId),
            where('shared', 'array-contains', userId)
        )    
    );
    return onSnapshot(q, (snapshot) => {
        const trips: Trip[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip));
        callback(trips);
    });
};
import { db } from './firebase';
import { collection, collectionGroup, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
import { Event } from '../types/event';

const eventsCol = (tripId: string, dayId: string) =>
  collection(db, 'trips', tripId, 'days', dayId, 'events');

export const createEvent = async (event: Omit<Event, 'id'>): Promise<Event> => {
  try {
    const docRef = await addDoc(eventsCol(event.tripId, event.dayId), event);
    return { ...event, id: docRef.id } as Event;
  } catch (error) {
    console.error('Error adding event: ', error);
    throw error;
  }
};

export const updateEvent = async (tripId: string, dayId: string, id: string, updatedEvent: Partial<Event>) => {
  try {
    await updateDoc(doc(eventsCol(tripId, dayId), id), updatedEvent);
  } catch (error) {
    console.error('Error updating event: ', error);
    throw error;
  }
};

export const deleteEvent = async (tripId: string, dayId: string, id: string) => {
  try {
    await deleteDoc(doc(eventsCol(tripId, dayId), id));
  } catch (error) {
    console.error('Error deleting event: ', error);
    throw error;
  }
};

// Subscribes to all events for a specific trip across all its days.
export const subscribeToEvents = (tripId: string, callback: (events: Event[]) => void) => {
  const q = query(collectionGroup(db, 'events'), where('tripId', '==', tripId));
  return onSnapshot(q, (snapshot) => {
    const events: Event[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
    callback(events);
  });
};

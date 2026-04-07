import { db } from './firebase';
import { collection, collectionGroup, doc, addDoc, updateDoc, deleteDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Event } from '../types/event';
import { hasActionPermission, PermissionError } from './permissionService';

const eventsCol = (tripId: string, dayId: string) =>
  collection(db, 'trips', tripId, 'days', dayId, 'events');

export const createEvent = async (uid: string, event: Omit<Event, 'id'>): Promise<Event> => {
  const allowed = await hasActionPermission(uid, event.tripId, 'add_event');
  if (!allowed) throw new PermissionError('add_event');
  try {
    const docRef = await addDoc(eventsCol(event.tripId, event.dayId), event);
    return { ...event, id: docRef.id } as Event;
  } catch (error) {
    console.error('Error adding event: ', error);
    throw error;
  }
};

export const updateEvent = async (uid: string, tripId: string, dayId: string, id: string, updatedEvent: Partial<Event>) => {
  const allowed = await hasActionPermission(uid, tripId, 'edit_event');
  if (!allowed) throw new PermissionError('edit_event');
  try {
    await updateDoc(doc(eventsCol(tripId, dayId), id), updatedEvent);
  } catch (error) {
    console.error('Error updating event: ', error);
    throw error;
  }
};

export const deleteEvent = async (uid: string, tripId: string, dayId: string, id: string) => {
  const allowed = await hasActionPermission(uid, tripId, 'delete_event');
  if (!allowed) throw new PermissionError('delete_event');
  try {
    await deleteDoc(doc(eventsCol(tripId, dayId), id));
  } catch (error) {
    console.error('Error deleting event: ', error);
    throw error;
  }
};

// Subscribes to all events for a specific trip across all its days.
export const subscribeToEvents = (tripId: string, callback: (events: Event[]) => void) => {
  const q = query(
    collectionGroup(db, 'events'),
    where('tripId', '==', tripId),
    orderBy('date', 'asc')
  );
  return onSnapshot(q, (snapshot) => {
    const events: Event[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
    callback(events);
  });
};

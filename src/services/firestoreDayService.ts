// Manages day documents stored as a subcollection at trips/{tripId}/days/{dayId}.
// Each day stores its tripId so it can be queried independently.
// Events store a dayId and are deleted by dayId when a day is removed.

import { db } from './firebase';
import { collection, doc, setDoc, updateDoc, getDocs, onSnapshot, query, orderBy, where, writeBatch, Timestamp } from 'firebase/firestore';
import { Day } from '../types/day';
import { toDate } from '../utilities/timestamps';

// Shape stored in Firestore — events are excluded; date is a Timestamp.
type StoredDay = { id: string; tripId: string; date: Timestamp; label: string };

const daysCol = (tripId: string) => collection(db, 'trips', tripId, 'days');

// Creates a new day document and returns the generated Firestore ID.
export const createDay = async (tripId: string, date: Date, label: string): Promise<string> => {
  const ref = doc(daysCol(tripId));
  const stored: StoredDay = { id: ref.id, tripId, date: Timestamp.fromDate(date), label };
  await setDoc(ref, stored);
  return ref.id;
};

// Updates only the user-visible label of a day.
export const updateDayLabel = async (tripId: string, dayId: string, label: string): Promise<void> => {
  await updateDoc(doc(daysCol(tripId), dayId), { label });
};

// Updates the calendar date of a day (used when shifting all days after a start-date change).
export const updateDayDate = async (tripId: string, dayId: string, date: Date): Promise<void> => {
  await updateDoc(doc(daysCol(tripId), dayId), { date: Timestamp.fromDate(date) });
};

// Deletes a day document and all events belonging to that day.
export const deleteDay = async (tripId: string, dayId: string): Promise<void> => {
  const eventsSnapshot = await getDocs(
    query(
      collection(db, 'events'),
      where('dayId', '==', dayId)
    )
  );

  const batch = writeBatch(db);
  eventsSnapshot.docs.forEach(d => batch.delete(d.ref));
  batch.delete(doc(daysCol(tripId), dayId));
  await batch.commit();
};

// Subscribes to all days for a trip, ordered by date. Returns an unsubscribe function.
// The callback receives days without events — callers are responsible for merging events.
export const subscribeToDays = (
  tripId: string,
  callback: (days: Omit<Day, 'events'>[]) => void
): (() => void) => {
  const q = query(daysCol(tripId), orderBy('date'));
  return onSnapshot(q, snapshot => {
    callback(
      snapshot.docs.map(d => {
        const data = d.data() as StoredDay;
        return { id: data.id, tripId: data.tripId, date: toDate(data.date), label: data.label };
      })
    );
  });
};

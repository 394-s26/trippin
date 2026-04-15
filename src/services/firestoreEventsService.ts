import { db } from './firebase';
import { collection, collectionGroup, doc, addDoc, updateDoc, deleteDoc, onSnapshot, orderBy, query, where, runTransaction, Timestamp } from 'firebase/firestore';
import { Event } from '../types/event';
import { hasActionPermission, PermissionError } from './permissionService';

const eventsCol = (tripId: string, dayId: string) =>
  collection(db, 'trips', tripId, 'days', dayId, 'events');

const eventLockDoc = (tripId: string, eventId: string) =>
  doc(db, 'sessions', tripId, 'eventLocks', eventId);

export const LOCK_TTL_MS = 60_000;

export interface EventLock {
  uid: string;
  acquiredAt: Timestamp;
  expiresAt: Timestamp;
}

export type AcquireLockResult =
  | { acquired: true }
  | { acquired: false; holderUid: string };

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

export const updateEvent = async (uid: string, tripId: string, dayId: string, id: string, updatedEvent: Omit<Event, 'id' | 'tripId' | 'dayId'>) => {
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

// Attempts to acquire an edit lock on an event. Lock is stored at
// sessions/{tripId}/eventLocks/{eventId}. If the existing lock is expired or
// held by the same user, it is re-acquired. Otherwise returns the holder's uid.
export const acquireEventLock = async (
  tripId: string,
  eventId: string,
  uid: string,
): Promise<AcquireLockResult> => {
  const ref = eventLockDoc(tripId, eventId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const nowMs = Date.now();
    const existing = snap.exists() ? (snap.data() as EventLock) : null;
    const expiresMs = existing?.expiresAt.toMillis() ?? 0;
    const heldByOther = existing && existing.uid !== uid && expiresMs > nowMs;
    if (heldByOther) {
      return { acquired: false, holderUid: existing!.uid } as AcquireLockResult;
    }
    const now = Timestamp.fromMillis(nowMs);
    const expires = Timestamp.fromMillis(nowMs + LOCK_TTL_MS);
    tx.set(ref, { uid, acquiredAt: now, expiresAt: expires });
    return { acquired: true } as AcquireLockResult;
  });
};

// Extends the lock expiration if the caller still holds it. Returns false if
// the lock was stolen or never held by this user, so the caller can bail out.
export const heartbeatEventLock = async (
  tripId: string,
  eventId: string,
  uid: string,
): Promise<boolean> => {
  const ref = eventLockDoc(tripId, eventId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return false;
    const existing = snap.data() as EventLock;
    const nowMs = Date.now();
    if (existing.uid !== uid || existing.expiresAt.toMillis() <= nowMs) {
      return false;
    }
    tx.update(ref, { expiresAt: Timestamp.fromMillis(nowMs + LOCK_TTL_MS) });
    return true;
  });
};

// Releases the lock only if the caller still holds it.
export const releaseEventLock = async (
  tripId: string,
  eventId: string,
  uid: string,
): Promise<void> => {
  const ref = eventLockDoc(tripId, eventId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const existing = snap.data() as EventLock;
    if (existing.uid === uid) tx.delete(ref);
  });
};

// Subscribes to the lock doc for a specific event. Callback receives the lock
// or null when no one holds it (or the lock expired on the client clock).
export const subscribeToEventLock = (
  tripId: string,
  eventId: string,
  callback: (lock: EventLock | null) => void,
) => {
  const ref = eventLockDoc(tripId, eventId);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) return callback(null);
    const lock = snap.data() as EventLock;
    if (lock.expiresAt.toMillis() <= Date.now()) return callback(null);
    callback(lock);
  });
};

// Subscribes to all events for a specific trip across all its days.
export const subscribeToEvents = (tripId: string, callback: (events: Event[]) => void) => {
  const q = query(
    collectionGroup(db, 'events'),
    where('tripId', '==', tripId),
    orderBy('startDate', 'asc')
  );
  return onSnapshot(q, (snapshot) => {
    const events: Event[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
    callback(events);
  });
};

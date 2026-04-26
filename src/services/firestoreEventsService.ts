import { db } from './firebase';
import { addDoc, arrayRemove, arrayUnion, collection, collectionGroup, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, runTransaction, Timestamp, updateDoc, where, FirestoreError } from 'firebase/firestore';
import { Event, EventSuggestion, SuggestionType, SuggestionVote } from '../types/event';
import { hasActionPermission, PermissionError } from './permissionService';
import { getSuggestionVoteThreshold, resolveCreateEventSuggestionMode } from '../utilities/eventSuggestions';

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

const buildSuggestion = (uid: string, type: SuggestionType, targetEventId?: string): EventSuggestion => ({
  type,
  createdBy: uid,
  votes: {
    yes: [uid],
    no: [],
  },
  ...(targetEventId ? { targetEventId } : {}),
});

export const createEvent = async (uid: string, event: Omit<Event, 'id'> & { isSuggestion?: boolean }): Promise<Event> => {
  const { isSuggestion = false, ...eventData } = event;
  const [canCreateEvent, canProposeEvent] = await Promise.all([
    hasActionPermission(uid, event.tripId, 'add_event'),
    hasActionPermission(uid, event.tripId, 'propose_create_event'),
  ]);

  const suggestionMode = resolveCreateEventSuggestionMode({
    canCreateEvent,
    canProposeEvent,
    requestedSuggestion: isSuggestion,
  });

  if (!canCreateEvent && !canProposeEvent) {
    throw new PermissionError('add_event');
  }

  const nextEvent: Omit<Event, 'id'> = {
    ...eventData,
    suggestion: suggestionMode ? buildSuggestion(uid, 'create') : null,
  };

  try {
    const docRef = await addDoc(eventsCol(event.tripId, event.dayId), nextEvent);
    return { ...nextEvent, id: docRef.id } as Event;
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

export const suggestEventDeletion = async (uid: string, event: Event): Promise<Event> => {
  if (event.suggestion) {
    throw new PermissionError('propose_delete_event');
  }

  const [canDeleteEvent, canProposeDelete] = await Promise.all([
    hasActionPermission(uid, event.tripId, 'delete_event'),
    hasActionPermission(uid, event.tripId, 'propose_delete_event'),
  ]);

  if (canDeleteEvent) {
    await deleteEvent(uid, event.tripId, event.dayId, event.id);
    return event;
  }

  if (!canProposeDelete) {
    throw new PermissionError('propose_delete_event');
  }

  const { id: _id, suggestion: _suggestion, ...eventData } = event;
  const nextEvent: Omit<Event, 'id'> = {
    ...eventData,
    suggestion: buildSuggestion(uid, 'delete', event.id),
  };

  try {
    const docRef = await addDoc(eventsCol(event.tripId, event.dayId), nextEvent);
    return { ...nextEvent, id: docRef.id } as Event;
  } catch (error) {
    console.error('Error suggesting event deletion: ', error);
    throw error;
  }
};

export const voteOnSuggestion = async (
  uid: string,
  tripId: string,
  dayId: string,
  eventId: string,
  vote: SuggestionVote
) => {
  const eventRef = doc(eventsCol(tripId, dayId), eventId);
  const snap = await getDoc(eventRef);
  if (!snap.exists()) return;

  const event = snap.data() as Event;
  if (!event.suggestion) return;

  try {
    if (vote === 'yes') {
      await updateDoc(eventRef, {
        'suggestion.votes.yes': arrayUnion(uid),
        'suggestion.votes.no': arrayRemove(uid),
      });
      return;
    }

    await updateDoc(eventRef, {
      'suggestion.votes.yes': arrayRemove(uid),
      'suggestion.votes.no': arrayUnion(uid),
    });
  } catch (error) {
    console.error('Error voting on suggestion: ', error);
    throw error;
  }
};

export const approveSuggestion = async (uid: string, event: Event) => {
  if (!event.suggestion) return;
  const suggestionRef = doc(eventsCol(event.tripId, event.dayId), event.id);

  try {
    const [allowed, tripSnap, suggestionSnap] = await Promise.all([
      hasActionPermission(uid, event.tripId, 'approve_suggestion'),
      getDoc(doc(db, 'trips', event.tripId)),
      getDoc(suggestionRef),
    ]);
    if (!suggestionSnap.exists()) return;

    const current = suggestionSnap.data() as Event;
    if (!current.suggestion) return;
    const shared = Array.isArray(tripSnap.data()?.shared) ? tripSnap.data()?.shared as string[] : [];
    const ownerId = typeof tripSnap.data()?.userId === 'string' ? tripSnap.data()?.userId as string : null;
    const totalUsers = new Set([...(ownerId ? [ownerId] : []), ...shared]).size;
    const threshold = getSuggestionVoteThreshold(totalUsers);
    const yesVotes = current.suggestion.votes.yes.length;
    const noVotes = current.suggestion.votes.no.length;

    if (!allowed) {
      const canCommunityApprove = yesVotes >= threshold;
      if (!canCommunityApprove) throw new PermissionError('approve_suggestion');
    }

    if (current.suggestion.type === 'delete') {
      const targetId = current.suggestion.targetEventId;
      if (targetId) {
        await deleteDoc(doc(eventsCol(event.tripId, event.dayId), targetId));
      }
      await deleteDoc(suggestionRef);
      return;
    }

    await updateDoc(suggestionRef, { suggestion: null });
  } catch (error) {
    console.error('Error approving suggestion: ', error);
    throw error;
  }
};

export const rejectDeletionSuggestion = async (uid: string, event: Event) => {
  if (!event.suggestion || event.suggestion.type !== 'delete') return;
  const suggestionRef = doc(eventsCol(event.tripId, event.dayId), event.id);
  await deleteDoc(suggestionRef);
};

export const resolveSuggestionByVote = async (
  uid: string,
  event: Event,
  resolution: 'approve' | 'delete',
) => {
  if (!event.suggestion) return;
  if (resolution === 'approve') {
    await approveSuggestion(uid, event);
    return;
  }

  const suggestionRef = doc(eventsCol(event.tripId, event.dayId), event.id);
  const suggestionSnap = await getDoc(suggestionRef);
  if (!suggestionSnap.exists()) return;
  const current = suggestionSnap.data() as Event;
  if (!current.suggestion) return;
  if (current.suggestion.type !== 'create') throw new PermissionError('approve_suggestion');

  const tripSnap = await getDoc(doc(db, 'trips', event.tripId));
  const shared = Array.isArray(tripSnap.data()?.shared) ? tripSnap.data()?.shared as string[] : [];
  const ownerId = typeof tripSnap.data()?.userId === 'string' ? tripSnap.data()?.userId as string : null;
  const totalUsers = new Set([...(ownerId ? [ownerId] : []), ...shared]).size;
  const threshold = getSuggestionVoteThreshold(totalUsers);
  const noVotes = current.suggestion.votes.no.length;
  if (noVotes < threshold) throw new PermissionError('approve_suggestion');

  await deleteDoc(suggestionRef);
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
  return onSnapshot(
    q,
    (snapshot) => {
      const events: Event[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
      callback(events);
    },
    (err: FirestoreError) => {
      console.error('[subscribeToEvents]', tripId, err.code, err.message);
    }
  );
};

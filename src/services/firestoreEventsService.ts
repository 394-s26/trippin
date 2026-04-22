import { db } from './firebase';
import { addDoc, arrayRemove, arrayUnion, collection, collectionGroup, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { Event, EventCreateInput, EventSuggestion, SuggestionType, SuggestionVote } from '../types/event';
import { hasActionPermission, PermissionError } from './permissionService';
import { resolveCreateEventSuggestionMode } from '../utilities/eventSuggestions';

const eventsCol = (tripId: string, dayId: string) =>
  collection(db, 'trips', tripId, 'days', dayId, 'events');

const buildSuggestion = (uid: string, type: SuggestionType, targetEventId?: string): EventSuggestion => ({
  type,
  createdBy: uid,
  votes: {
    yes: [uid],
    no: [],
  },
  ...(targetEventId ? { targetEventId } : {}),
});

export const createEvent = async (uid: string, event: EventCreateInput): Promise<Event> => {
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
  const allowed = await hasActionPermission(uid, event.tripId, 'approve_suggestion');
  if (!allowed) throw new PermissionError('approve_suggestion');

  const suggestionRef = doc(eventsCol(event.tripId, event.dayId), event.id);

  try {
    if (event.suggestion.type === 'delete') {
      const targetId = event.suggestion.targetEventId;
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

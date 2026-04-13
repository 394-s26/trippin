import { httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, arrayUnion, onSnapshot } from 'firebase/firestore';
import { db, functions } from './firebase';
import { Role } from '../config/permissions';

interface SendInviteParams {
  email: string;
  tripId: string;
  tripName: string;
  role: Role;
}

interface SendInviteResult {
  success: boolean;
  inviteId: string;
}

const sendInviteCallable = httpsCallable<SendInviteParams, SendInviteResult>(functions, 'sendInviteEmail');

/** Send an invite email to a non-registered user and store it in Firestore. */
export const sendInviteEmail = async (params: SendInviteParams): Promise<SendInviteResult> => {
  const result = await sendInviteCallable(params);
  return result.data;
};

/**
 * Client-side invite acceptance — runs directly against Firestore, no Cloud Function.
 * Finds all pending invites matching the given email, adds the user to each trip,
 * and marks the invites as accepted. Returns the accepted trip IDs.
 */
export const acceptPendingInvites = async (uid: string, email: string): Promise<string[]> => {
  const normalizedEmail = email.toLowerCase();

  // 1. Find all pending invites for this email
  const invitesSnap = await getDocs(
    query(
      collection(db, 'invites'),
      where('email', '==', normalizedEmail),
      where('status', '==', 'pending'),
    )
  );

  if (invitesSnap.empty) return [];

  const acceptedTripIds: string[] = [];

  // 2. For each invite, add the user to the trip and mark the invite accepted.
  //    NOTE: we do NOT getDoc on the trip first — the new user has no read access
  //    to the trip yet (they're not in shared[]). The self-enrollment Firestore rule
  //    allows the updateDoc to succeed directly.
  for (const inviteDoc of invitesSnap.docs) {
    const invite = inviteDoc.data();
    const tripRef = doc(db, 'trips', invite.tripId);

    try {
      // Add user to the trip's shared array and set their permission
      await updateDoc(tripRef, {
        shared: arrayUnion(uid),
        [`permissions.${uid}`]: invite.role,
      });

      // Mark invite as accepted
      await updateDoc(inviteDoc.ref, {
        status: 'accepted',
        acceptedBy: uid,
      });

      acceptedTripIds.push(invite.tripId);
    } catch (err) {
      // Trip may have been deleted or rules rejected the write — skip this invite
      console.error(`Failed to accept invite for trip ${invite.tripId}:`, err);
    }
  }

  return acceptedTripIds;
};

/** Check if a pending invite already exists for this email + trip. */
export const hasPendingInvite = async (email: string, tripId: string): Promise<boolean> => {
  const snap = await getDocs(
    query(
      collection(db, 'invites'),
      where('email', '==', email.toLowerCase()),
      where('tripId', '==', tripId),
      where('status', '==', 'pending'),
    )
  );
  return !snap.empty;
};

export interface PendingInvite {
  id: string;
  email: string;
  role: Role;
  invitedBy: string;
  inviterName: string;
  status: 'pending' | 'accepted' | 'expired';
}

/** Cancel (delete) a pending invite by its Firestore document ID. */
export const cancelInvite = async (inviteId: string): Promise<void> => {
  await deleteDoc(doc(db, 'invites', inviteId));
};

/** Fetch all pending invites for a specific trip (one-time read). */
export const getPendingInvitesForTrip = async (tripId: string): Promise<PendingInvite[]> => {
  const snap = await getDocs(
    query(
      collection(db, 'invites'),
      where('tripId', '==', tripId),
      where('status', '==', 'pending'),
    )
  );
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      email: data.email,
      role: data.role as Role,
      invitedBy: data.invitedBy,
      inviterName: data.inviterName,
      status: data.status,
    };
  });
};

/** Subscribe to pending invites for a trip in real-time.
 *  When a user signs up and accepts, the invite disappears automatically. */
export const subscribeToPendingInvites = (
  tripId: string,
  callback: (invites: PendingInvite[]) => void,
): (() => void) => {
  const q = query(
    collection(db, 'invites'),
    where('tripId', '==', tripId),
    where('status', '==', 'pending'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        email: data.email,
        role: data.role as Role,
        invitedBy: data.invitedBy,
        inviterName: data.inviterName,
        status: data.status,
      };
    }));
  });
};

import { getDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { Trip } from '../types/trip';
import { TripAction, Role, ROLE_PERMISSIONS } from '../config/permissions';

// Sync check — use when trip is already loaded in memory (UI gating, zero extra reads).
// Falls back gracefully for trips that predate the permissions field.
export const canPerformAction = (uid: string, trip: Trip, action: TripAction): boolean => {
  const permissions = trip.permissions ?? {};
  const role: Role = permissions[uid] ?? (uid === trip.userId ? 'owner' : 'explorer');
  return (ROLE_PERMISSIONS[role] as string[]).includes(action);
};

// Async check — use as a guard inside service write functions.
// Reads the trip document from Firestore to get current permissions.
export const hasActionPermission = async (
  uid: string,
  tripId: string,
  action: TripAction
): Promise<boolean> => {
  const snap = await getDoc(doc(db, 'trips', tripId));
  if (!snap.exists()) return false;
  const trip = snap.data() as Trip;
  return canPerformAction(uid, trip, action);
};

// Thrown by service functions when a permission check fails.
export class PermissionError extends Error {
  constructor(action: TripAction) {
    super(`Permission denied: cannot perform '${action}'`);
    this.name = 'PermissionError';
  }
}

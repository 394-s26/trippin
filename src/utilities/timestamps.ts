import { Timestamp } from 'firebase/firestore';

// Converts a Firestore Timestamp to a JS Date. If already a Date, returns as-is.
export const toDate = (value: Timestamp | Date): Date =>
  value instanceof Timestamp ? value.toDate() : value;

// Converts a JS Date to a Firestore Timestamp. If already a Timestamp, returns as-is.
export const toTimestamp = (value: Date | Timestamp): Timestamp =>
  value instanceof Date ? Timestamp.fromDate(value) : value;

// A Day represents a single calendar day within a trip.
// Days are stored as their own data type (intended for a Firestore sub-collection
// under trips/{tripId}/days/{dayId}). Events are populated on a Day by matching
// their `date` field to the Day's `date` once the Firebase implementation is complete.

import { Event } from './event';

export interface Day {
  id: string;
  tripId: string;   // ID of the trip this day belongs to
  date: Date;       // The calendar date this day represents
  label: string;    // User-editable name shown in the itinerary (e.g. "Arrival Day")
  events: Event[];  // Events occurring on this day
}

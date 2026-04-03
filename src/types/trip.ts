// This file defines TypeScript interfaces for trip data structures.

// The total budget for a trip, stored in USD.
export type Budget = number;

export interface Trip {
  id: string;
  userId: string;        // UID of the Firebase Auth user who owns this trip
  name: string;
  startDate: Date;       // The calendar date the trip begins
  budget: Budget;        // Total trip budget in USD
  bannerImageUrl: string | null;  // null = use default green background
  shared: string[];     // UIDs of users this trip has been shared with
  // Days are stored in the subcollection trips/{tripId}/days — see firestoreDayService.ts
}

// This file defines TypeScript interfaces for trip data structures.

import { Role } from '../config/permissions';

// The total budget for a trip, stored in USD.
export type Budget = number;

export type SplitMethod = 'even' | 'byEvent';

export interface Trip {
  id: string;
  userId: string;        // UID of the Firebase Auth user who owns this trip
  name: string;
  startDate: Date;       // The calendar date the trip begins
  endDate: Date;         // The calendar date the trip ends
  budget: Budget;        // Total trip budget in USD
  bannerImageUrl: string | null;  // null = use default green background
  shared: string[];     // UIDs of users this trip has been shared with
  splitMethod?: SplitMethod; // How costs are split; defaults to 'even' when absent
  permissions: Record<string, Role>; // { [uid]: role } — who can do what
  // Days are stored in the subcollection trips/{tripId}/days — see firestoreDayService.ts
}

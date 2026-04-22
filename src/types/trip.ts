// This file defines TypeScript interfaces for trip data structures.

import { Role } from '../config/permissions';

// The total budget for a trip, stored in USD.
export type Budget = number;

export type SplitMethod = 'even' | 'byEvent' | 'percentage' | 'shares';

// Per-member config for advanced split methods.
// Keys are UIDs. Values are percentages (for 'percentage') or share weights (for 'shares').
// Ignored when splitMethod is 'even' or 'byEvent'.
export type SplitConfig = Record<string, number>;

export interface LastViewedTrip {
  tripId: string;
  tripName: string;
  bannerImageUrl: string | null;
}

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
  splitConfig?: SplitConfig; // Per-member values for 'percentage' or 'shares' methods
  permissions: Record<string, Role>; // { [uid]: role } — who can do what
  // Days are stored in the subcollection trips/{tripId}/days — see firestoreDayService.ts
}

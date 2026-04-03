// This file defines TypeScript interfaces for event data structures.
// Each event kind is its own interface extending BaseEvent, forming a discriminated union on `type`.

interface BaseEvent {
  id: string;
  tripId: string;        // ID of the trip this event belongs to
  dayId: string;         // ID of the day this event belongs to
  name: string;
  cost?: number | null; // Optional — omit from card when null
  date: Date;
  location?: string;
  timezone?: string;
}

export interface HotelEvent extends BaseEvent {
  type: 'Hotel';
}

export interface RestaurantEvent extends BaseEvent {
  type: 'Restaurant';
}

export interface ActivityEvent extends BaseEvent {
  type: 'Activity';
}

export interface FoodEvent extends BaseEvent {
  type: 'Food';
}

// Union of all event kinds. Use `event.type` to narrow to a specific kind.
export type Event = HotelEvent | RestaurantEvent | ActivityEvent | FoodEvent;

// Partial update type used for Firestore updateDoc calls.
export interface EventUpdate {
  id: string;
  type?: Event['type'];
  name?: string;
  cost?: number | null;
  date?: Date;
  location?: string;
  timezone?: string;
}

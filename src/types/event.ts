// This file defines TypeScript interfaces for event data structures.
// Each event kind is its own interface extending BaseEvent, forming a discriminated union on `type`.

interface BaseEvent {
  id: string;
  tripId: string;        // ID of the trip this event belongs to
  dayId: string;         // ID of the day this event belongs to
  name: string;
  cost?: number | null; // Optional — omit from card when null
  startDate: Date;
  endDate?: Date | null;
  location?: string;
  timezone?: string;
  endTimezone?: string | null; // Optional separate end-time zone; null = same as `timezone`
  paidBy?: string | null; // UID of the user responsible for paying; null = unassigned
  color?: string | null; // Color label token from EVENT_COLORS; null = no color
  allDay?: boolean; // True = day-bounded event; start/end Dates carry no meaningful time
}

// Transportation-specific event types
export interface FlightEvent extends BaseEvent { type: 'Flight'; }
export interface TrainEvent extends BaseEvent { type: 'Train'; }
export interface BusEvent extends BaseEvent { type: 'Bus'; }
export interface CarEvent extends BaseEvent { type: 'Car'; }
export interface BoatEvent extends BaseEvent { type: 'Boat'; }

// Location-specific event types
export interface HotelEvent extends BaseEvent { type: 'Hotel'; }
export interface AirbnbEvent extends BaseEvent { type: 'Airbnb'; }
export interface CampingEvent extends BaseEvent { type: 'Camping'; }

// Activity-specific event types
export interface HikingEvent extends BaseEvent { type: 'Hiking'; }
export interface SwimmingEvent extends BaseEvent { type: 'Swimming'; }
export interface RaftingEvent extends BaseEvent { type: 'Rafting'; }
export interface SurfingEvent extends BaseEvent { type: 'Surfing'; }
export interface SkiingEvent extends BaseEvent { type: 'Skiing'; }
export interface ShoppingEvent extends BaseEvent { type: 'Shopping'; }
export interface SightseeingEvent extends BaseEvent { type: 'Sightseeing'; }

// Location-specific activity event types
export interface MuseumEvent extends BaseEvent { type: 'Museum'; }
export interface TourEvent extends BaseEvent { type: 'Tour'; }
export interface GameEvent extends BaseEvent { type: 'Game'; }
export interface ConcertEvent extends BaseEvent { type: 'Concert'; }
export interface BeachEvent extends BaseEvent { type: 'Beach'; }
export interface ParkEvent extends BaseEvent { type: 'Park'; }
export interface ZooEvent extends BaseEvent { type: 'Zoo'; }
export interface AquariumEvent extends BaseEvent { type: 'Aquarium'; }


// Food related events
export interface RestaurantEvent extends BaseEvent { type: 'Restaurant'; }
export interface CafeEvent extends BaseEvent { type: 'Cafe'; }
export interface BarEvent extends BaseEvent { type: 'Bar'; }
export interface ClubEvent extends BaseEvent { type: 'Club'; }

// Union of all event kinds. Use `event.type` to narrow to a specific kind.
export type Event =
  | FlightEvent | TrainEvent | BusEvent | CarEvent | BoatEvent
  | HotelEvent | AirbnbEvent | CampingEvent
  | HikingEvent | SwimmingEvent | RaftingEvent | SurfingEvent | SkiingEvent | ShoppingEvent | SightseeingEvent
  | MuseumEvent | TourEvent | GameEvent | ConcertEvent | BeachEvent | ParkEvent | ZooEvent | AquariumEvent
  | RestaurantEvent | CafeEvent | BarEvent | ClubEvent;

// Category grouping derived from event type — no extra data stored in Firestore.
export type EventCategory = 'Transportation' | 'Lodging' | 'Activity' | 'Attraction' | 'Food & Drink';

export const EVENT_CATEGORY: Record<Event['type'], EventCategory> = {
  Flight: 'Transportation',
  Train: 'Transportation',
  Bus: 'Transportation',
  Car: 'Transportation',
  Boat: 'Transportation',

  Hotel: 'Lodging',
  Airbnb: 'Lodging',
  Camping: 'Lodging',

  Hiking: 'Activity',
  Swimming: 'Activity',
  Rafting: 'Activity',
  Surfing: 'Activity',
  Skiing: 'Activity',
  Shopping: 'Activity',
  Sightseeing: 'Activity',

  Museum: 'Attraction',
  Tour: 'Attraction',
  Game: 'Attraction',
  Concert: 'Attraction',
  Beach: 'Attraction',
  Park: 'Attraction',
  Zoo: 'Attraction',
  Aquarium: 'Attraction',

  Restaurant: 'Food & Drink',
  Cafe: 'Food & Drink',
  Bar: 'Food & Drink',
  Club: 'Food & Drink',
};

// Partial update type used for Firestore updateDoc calls.
export interface EventUpdate {
  id: string;
  type: Event['type'];
  name: string;
  cost?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  location?: string;
  timezone?: string;
  endTimezone?: string | null;
  paidBy?: string | null;
  color?: string | null;
  allDay?: boolean;
}

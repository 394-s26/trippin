export type SuggestionType = 'create' | 'delete';
export type SuggestionVote = 'yes' | 'no';

export interface EventSuggestionVotes {
  yes: string[];
  no: string[];
}

export interface EventSuggestion {
  type: SuggestionType;
  createdBy: string;
  votes: EventSuggestionVotes;
  targetEventId?: string;
}

interface BaseEvent {
  id: string;
  tripId: string;
  dayId: string;
  name: string;
  cost?: number | null;
  startDate: Date;
  endDate?: Date | null;
  location?: string;
  lat?: number;
  lng?: number;
  timezone?: string;
  endTimezone?: string | null;
  paidBy?: string | null;
  color?: string | null;
  allDay?: boolean;
  imageUrl?: string | null;
  suggestion?: EventSuggestion | null;
}

// Transportation-specific event types
export interface FlightEvent extends BaseEvent { type: 'Flight'; }
export interface TrainEvent extends BaseEvent { type: 'Train'; }
export interface BusEvent extends BaseEvent { type: 'Bus'; }
export interface CarEvent extends BaseEvent { type: 'Car'; }
export interface BoatEvent extends BaseEvent { type: 'Boat'; }

// Lodging-specific event types
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

// Attraction-specific event types
export interface MuseumEvent extends BaseEvent { type: 'Museum'; }
export interface TourEvent extends BaseEvent { type: 'Tour'; }
export interface GameEvent extends BaseEvent { type: 'Game'; }
export interface ConcertEvent extends BaseEvent { type: 'Concert'; }
export interface BeachEvent extends BaseEvent { type: 'Beach'; }
export interface ParkEvent extends BaseEvent { type: 'Park'; }
export interface ZooEvent extends BaseEvent { type: 'Zoo'; }
export interface AquariumEvent extends BaseEvent { type: 'Aquarium'; }

// Food & Drink event types
export interface RestaurantEvent extends BaseEvent { type: 'Restaurant'; }
export interface CafeEvent extends BaseEvent { type: 'Cafe'; }
export interface BarEvent extends BaseEvent { type: 'Bar'; }
export interface ClubEvent extends BaseEvent { type: 'Club'; }

// Uncategorized
export interface NoneEvent extends BaseEvent { type: 'None'; }

// Union of all event kinds. Use `event.type` to narrow to a specific kind.
export type Event =
  | FlightEvent | TrainEvent | BusEvent | CarEvent | BoatEvent
  | HotelEvent | AirbnbEvent | CampingEvent
  | HikingEvent | SwimmingEvent | RaftingEvent | SurfingEvent | SkiingEvent | ShoppingEvent | SightseeingEvent
  | MuseumEvent | TourEvent | GameEvent | ConcertEvent | BeachEvent | ParkEvent | ZooEvent | AquariumEvent
  | RestaurantEvent | CafeEvent | BarEvent | ClubEvent
  | NoneEvent;

// Category grouping derived from event type — no extra data stored in Firestore.
export type EventCategory = 'Transportation' | 'Lodging' | 'Activity' | 'Attraction' | 'Food & Drink' | 'None';

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

  None: 'None',
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
  lat?: number;
  lng?: number;
  timezone?: string;
  endTimezone?: string | null;
  paidBy?: string | null;
  color?: string | null;
  allDay?: boolean;
  imageUrl?: string | null;
  suggestion?: EventSuggestion | null;
}

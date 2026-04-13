// This file defines TypeScript interfaces for event data structures.

export type EventType = 'Hotel' | 'Restaurant' | 'Activity' | 'Food';
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

export interface Event {
  id: string;
  tripId: string;        // ID of the trip this event belongs to
  dayId: string;         // ID of the day this event belongs to
  type: EventType;
  name: string;
  cost?: number | null; // Optional — omit from card when null
  startDate: Date;
  endDate?: Date | null;
  location?: string;
  timezone?: string;
  paidBy?: string | null; // UID of the user responsible for paying; null = unassigned
  suggestion?: EventSuggestion | null;
}

export interface EventDraft {
  type: EventType;
  name: string;
  cost?: number | null;
  startDate: Date;
  endDate?: Date | null;
  location?: string;
  timezone?: string;
  paidBy?: string | null;
  isSuggestion?: boolean;
}

export interface EventCreateInput extends EventDraft {
  tripId: string;
  dayId: string;
}

// Partial update type used for Firestore updateDoc calls.
export interface EventUpdate {
  id: string;
  type?: EventType;
  name?: string;
  cost?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  location?: string;
  timezone?: string;
  paidBy?: string | null;
  suggestion?: EventSuggestion | null;
}

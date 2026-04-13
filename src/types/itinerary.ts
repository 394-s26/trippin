import { Day } from './day';
import { Event } from './event';

export type ItineraryEventVariant = 'default' | 'hotel-continuation';

export interface ItineraryEventItem {
  event: Event;
  variant: ItineraryEventVariant;
}

export interface ItineraryDay extends Omit<Day, 'events'> {
  events: ItineraryEventItem[];
}

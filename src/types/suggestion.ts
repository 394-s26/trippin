import { Event } from './event';

export interface DaySuggestion {
  name: string;
  eventType: Event['type'];
  description: string;
  location: string;
  lat: number;
  lng: number;
  googleMapsUrl: string;
  imageUrl: string | null;
  estimatedCost: number;
}

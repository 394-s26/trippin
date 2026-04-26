import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { DaySuggestion } from '../types/suggestion';

export interface AutoFillInput {
  tripId: string;
  lat: number;
  lng: number;
  locationName: string;
}

export const fetchDaySuggestions = async (input: AutoFillInput): Promise<DaySuggestion[]> => {
  try {
    const callable = httpsCallable<AutoFillInput, { suggestions: DaySuggestion[] }>(
      functions,
      'autoFillDay'
    );
    const { data } = await callable(input);
    return data.suggestions;
  } catch (error) {
    console.error('Auto-fill day failed:', error);
    throw error;
  }
};

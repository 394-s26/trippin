import { describe, it, expect, vi, beforeEach } from 'vitest';

const callableFn = vi.fn();
const httpsCallableFn = vi.fn((_app: unknown, _name: string) => callableFn);

vi.mock('firebase/functions', () => ({
  httpsCallable: (app: unknown, name: string) => httpsCallableFn(app, name),
}));

vi.mock('./firebase', () => ({
  functions: { __mock: true },
}));

import { fetchDaySuggestions } from './autoFillService';
import { DaySuggestion } from '../types/suggestion';

const fakeSuggestion: DaySuggestion = {
  name: 'Navy Pier',
  eventType: 'Sightseeing',
  description: 'Chicago landmark.',
  location: 'Chicago, IL',
  lat: 41.89,
  lng: -87.6,
  googleMapsUrl: 'https://maps.google.com/?q=Navy+Pier',
  imageUrl: null,
  estimatedCost: 10,
};

describe('fetchDaySuggestions', () => {
  beforeEach(() => {
    callableFn.mockReset();
    httpsCallableFn.mockClear();
  });

  it('calls the autoFillDay callable with the input and unwraps suggestions', async () => {
    callableFn.mockResolvedValue({ data: { suggestions: [fakeSuggestion] } });

    const input = { tripId: 't1', lat: 41.9, lng: -87.6, locationName: 'Chicago' };
    const out = await fetchDaySuggestions(input);

    expect(httpsCallableFn).toHaveBeenCalledWith({ __mock: true }, 'autoFillDay');
    expect(callableFn).toHaveBeenCalledWith(input);
    expect(out).toEqual([fakeSuggestion]);
  });

  it('propagates callable errors', async () => {
    callableFn.mockRejectedValue(new Error('permission-denied'));
    await expect(
      fetchDaySuggestions({ tripId: 't1', lat: 0, lng: 0, locationName: 'x' })
    ).rejects.toThrow('permission-denied');
  });
});

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AutoFillDaySuggestionsModal from './AutoFillDaySuggestionsModal';
import { DaySuggestion } from '../types/suggestion';
import { Day } from '../types/day';

const fetchDaySuggestionsMock = vi.fn();
const createEventMock = vi.fn();

vi.mock('../services/autoFillService', () => ({
  fetchDaySuggestions: (...args: unknown[]) => fetchDaySuggestionsMock(...args),
}));

vi.mock('../services/firestoreEventsService', () => ({
  createEvent: (...args: unknown[]) => createEventMock(...args),
}));

const makeSuggestion = (i: number): DaySuggestion => ({
  name: `Place ${i}`,
  eventType: 'Sightseeing',
  description: `Desc ${i}`,
  location: `Loc ${i}`,
  lat: 1,
  lng: 2,
  googleMapsUrl: 'https://x',
  imageUrl: null,
  estimatedCost: 10 + i,
});

const day: Day = {
  id: 'day-1',
  tripId: 'trip-1',
  date: new Date('2026-04-25T00:00:00'),
  label: 'Day 1',
  events: [],
};

const location = { name: 'Chicago, Illinois', lat: 41.88, lng: -87.63 };

describe('AutoFillDaySuggestionsModal', () => {
  beforeEach(() => {
    fetchDaySuggestionsMock.mockReset();
    createEventMock.mockReset();
  });

  it('renders at least 5 suggestions and disables submit until a row has times', async () => {
    fetchDaySuggestionsMock.mockResolvedValue(
      [0, 1, 2, 3, 4].map(makeSuggestion)
    );

    render(
      <AutoFillDaySuggestionsModal
        isOpen={true}
        day={day}
        tripId="trip-1"
        uid="user-1"
        location={location}
        onClose={() => {}}
        onCompleted={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByText('Place 0')).toBeInTheDocument());
    for (let i = 0; i < 5; i++) {
      expect(screen.getByText(`Place ${i}`)).toBeInTheDocument();
    }

    // Submit disabled with no selection.
    const submit = screen.getByRole('button', { name: /select places/i });
    expect(submit).toBeDisabled();
  });

  it('batches createEvent calls for every selected row on confirm', async () => {
    fetchDaySuggestionsMock.mockResolvedValue(
      [0, 1, 2, 3, 4].map(makeSuggestion)
    );
    createEventMock.mockResolvedValue(undefined);
    const onCompleted = vi.fn();

    render(
      <AutoFillDaySuggestionsModal
        isOpen={true}
        day={day}
        tripId="trip-1"
        uid="user-1"
        location={location}
        onClose={() => {}}
        onCompleted={onCompleted}
      />
    );

    await waitFor(() => expect(screen.getByText('Place 0')).toBeInTheDocument());

    // Pick the first two suggestions.
    fireEvent.click(screen.getByLabelText('Select Place 0'));
    fireEvent.click(screen.getByLabelText('Select Place 1'));

    // Fill times for both.
    const timeInputs = screen.getAllByDisplayValue('');
    // For each selected row we expect Start + End time inputs; fill in pairs.
    fireEvent.change(timeInputs[0], { target: { value: '09:00' } });
    fireEvent.change(timeInputs[1], { target: { value: '10:00' } });
    fireEvent.change(timeInputs[2], { target: { value: '11:00' } });
    fireEvent.change(timeInputs[3], { target: { value: '12:00' } });

    const confirm = screen.getByRole('button', { name: /add 2 to day/i });
    fireEvent.click(confirm);

    await waitFor(() => expect(createEventMock).toHaveBeenCalledTimes(2));
    expect(onCompleted).toHaveBeenCalled();
  });
});

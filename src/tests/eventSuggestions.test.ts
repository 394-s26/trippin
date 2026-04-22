import { describe, expect, it } from 'vitest';
import { Event } from '../types/event';
import { getSuggestionVoteSummary, resolveCreateEventSuggestionMode } from '../utilities/eventSuggestions';

const baseSuggestionEvent: Event = {
  id: 'event-1',
  tripId: 'trip-1',
  dayId: 'day-1',
  type: 'Activity',
  name: 'Rafting',
  startDate: new Date('2026-04-08T16:00:00Z'),
  suggestion: {
    type: 'create',
    createdBy: 'user-1',
    votes: {
      yes: ['user-1', 'user-2', 'user-3'],
      no: ['user-4'],
    },
  },
};

describe('resolveCreateEventSuggestionMode', () => {
  it('forces suggestion mode for proposal-only members', () => {
    expect(resolveCreateEventSuggestionMode({
      canCreateEvent: false,
      canProposeEvent: true,
      requestedSuggestion: false,
    })).toBe(true);
  });

  it('respects the toggle for direct creators', () => {
    expect(resolveCreateEventSuggestionMode({
      canCreateEvent: true,
      canProposeEvent: true,
      requestedSuggestion: false,
    })).toBe(false);

    expect(resolveCreateEventSuggestionMode({
      canCreateEvent: true,
      canProposeEvent: true,
      requestedSuggestion: true,
    })).toBe(true);
  });
});

describe('getSuggestionVoteSummary', () => {
  it('derives vote counts and ratios from the member total', () => {
    expect(getSuggestionVoteSummary(baseSuggestionEvent, 4)).toEqual({
      yesVotes: 3,
      noVotes: 1,
      yesRatio: 0.75,
      noRatio: 0.25,
      consensusRatio: 0.75,
      leadingVote: 'yes',
      totalUsers: 4,
    });
  });

  it('uses the larger vote count when members are still loading', () => {
    expect(getSuggestionVoteSummary(baseSuggestionEvent, 0).totalUsers).toBe(3);
  });
});

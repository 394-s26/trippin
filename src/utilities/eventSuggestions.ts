import { Event, SuggestionVote } from '../types/event';

interface CreateEventModeInput {
  canCreateEvent: boolean;
  canProposeEvent: boolean;
  requestedSuggestion: boolean;
}

export const resolveCreateEventSuggestionMode = ({
  canCreateEvent,
  canProposeEvent,
  requestedSuggestion,
}: CreateEventModeInput): boolean => {
  if (requestedSuggestion) {
    return canCreateEvent || canProposeEvent;
  }

  if (canCreateEvent) {
    return false;
  }

  return canProposeEvent;
};

export const getSuggestionVoteSummary = (event: Event, totalUsers: number) => {
  const yesVotes = event.suggestion?.votes.yes.length ?? 0;
  const noVotes = event.suggestion?.votes.no.length ?? 0;
  const normalizedTotal = Math.max(totalUsers, yesVotes, noVotes, 1);
  const yesRatio = yesVotes / normalizedTotal;
  const noRatio = noVotes / normalizedTotal;
  const leadingVotes = Math.max(yesVotes, noVotes);
  const consensusRatio = leadingVotes / normalizedTotal;
  const leadingVote: SuggestionVote = yesVotes >= noVotes ? 'yes' : 'no';

  return {
    yesVotes,
    noVotes,
    yesRatio,
    noRatio,
    consensusRatio,
    leadingVote,
    totalUsers: normalizedTotal,
  };
};

export const getSuggestionVoteThreshold = (totalUsers: number): number =>
  Math.floor(totalUsers * 0.75);

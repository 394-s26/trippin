import { CSSProperties, ReactElement } from 'react';
import { Event, SuggestionVote } from '../types/event';
import { AppUser } from '../types/auth';
import { ActivityIcon, BedIcon, CheckIcon, FoodIcon, RestaurantIcon, XIcon } from '../services/svgIcons';
import { UserSelection } from '../hooks/useSessionSelections';
import { pickFirstSelector } from '../utilities/pickFirstSelector';
import { getSuggestionVoteSummary } from '../utilities/eventSuggestions';
import UserAvatar from './UserAvatar';
import './EventCard.css';

interface EventCardProps {
  event: Event;
  onSelect?: () => void;
  isSelected?: boolean;
  allSelections?: UserSelection[];
  currentUserId?: string;
  tripUsers?: AppUser[];
  totalTripUsers?: number;
  onVoteSuggestion?: (event: Event, vote: SuggestionVote) => void;
}

const TYPE_ICONS: Record<Event['type'], ReactElement> = {
  Hotel: <BedIcon size={24} />,
  Restaurant: <RestaurantIcon size={24} />,
  Activity: <ActivityIcon size={24} />,
  Food: <FoodIcon size={24} />,
};

const EventCard = ({
  event,
  onSelect,
  isSelected = false,
  allSelections = [],
  currentUserId,
  tripUsers = [],
  totalTripUsers = 0,
  onVoteSuggestion,
}: EventCardProps) => {
  const timeFmt = (d: Date) => new Date(d).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const startTime = timeFmt(event.startDate);
  const time = event.endDate ? `${startTime} – ${timeFmt(event.endDate)}` : startTime;

  const otherSelectors = allSelections.filter(
    s => s.uid !== currentUserId && s.selectedIds.includes(event.id),
  );
  const firstOther = pickFirstSelector(allSelections, event.id, currentUserId);
  const isSuggestion = !!event.suggestion;
  const suggestionType = event.suggestion?.type;
  const myVote = currentUserId && event.suggestion
    ? (event.suggestion.votes.yes.includes(currentUserId) ? 'yes' : event.suggestion.votes.no.includes(currentUserId) ? 'no' : null)
    : null;
  const {
    yesVotes,
    noVotes,
    yesRatio,
    noRatio,
    consensusRatio,
    leadingVote,
    totalUsers,
  } = getSuggestionVoteSummary(event, totalTripUsers);

  const useOtherBorder = !!firstOther && !isSelected;
  const cardClass = isSelected
    ? `event-card${isSuggestion ? ' event-card--suggestion' : ''} event-card--selected`
    : useOtherBorder
      ? `event-card${isSuggestion ? ' event-card--suggestion' : ''} event-card--selected-session`
      : `event-card${isSuggestion ? ' event-card--suggestion' : ''}`;
  const cardStyle = (useOtherBorder ? { borderColor: firstOther.color } : undefined) as CSSProperties | undefined;
  const consensusFillStyle = {
    width: `${consensusRatio * 100}%`,
    backgroundColor: leadingVote === 'yes' ? '#2d5a27' : '#b42318',
  };
  const yesStyle = { ['--vote-fill' as string]: `${yesRatio * 100}%` } as CSSProperties;
  const noStyle = { ['--vote-fill' as string]: `${noRatio * 100}%` } as CSSProperties;
  const voteTitle = suggestionType === 'delete' ? 'Vote: should we remove this?' : 'Vote: should we do this?';
  const proposalBadge = suggestionType === 'delete' ? 'Delete Proposal' : 'Proposed';

  return (
    <div className={cardClass} style={cardStyle} onClick={onSelect}>
      <div className="event-card-header">
        <div className="event-card-body">
          <div className="event-card-time-row">
            <span className="event-card-time">{time}</span>
            {isSuggestion && (
              <span className="event-card-proposed-badge">{proposalBadge}</span>
            )}
            {otherSelectors.length > 0 && (
              <div className="event-card-selectors">
                {otherSelectors.map(s => (
                  <UserAvatar
                    key={s.uid}
                    user={tripUsers.find(u => u.uid === s.uid) ?? null}
                    size="sm"
                    borderColor={s.color}
                  />
                ))}
              </div>
            )}
          </div>
          <h3 className="event-card-name">{event.name}</h3>
          {event.location && (
            <p className="event-card-meta">{event.location}</p>
          )}
          {event.cost != null && (
            <p className="event-card-meta">${event.cost.toFixed(2)}</p>
          )}
        </div>
        <div className="event-card-icon">
          {TYPE_ICONS[event.type]}
        </div>
      </div>

      {isSuggestion && (
        <div className="event-card-vote" onClick={(e) => e.stopPropagation()}>
          <p className="event-card-vote-title">{voteTitle}</p>

          <div className="event-card-vote-actions">
            <button
              type="button"
              className={`event-card-vote-btn event-card-vote-btn--yes${myVote === 'yes' ? ' event-card-vote-btn--active' : ''}`}
              style={yesStyle}
              onClick={() => onVoteSuggestion?.(event, 'yes')}
            >
              <span className="event-card-vote-btn-icon">
                <CheckIcon size={18} />
              </span>
              <span className="event-card-vote-btn-label">
                {suggestionType === 'delete' ? 'Do it' : 'Count me in'}
              </span>
              <span className="event-card-vote-btn-count">{yesVotes}/{totalUsers}</span>
            </button>

            <button
              type="button"
              className={`event-card-vote-btn event-card-vote-btn--no${myVote === 'no' ? ' event-card-vote-btn--active' : ''}`}
              style={noStyle}
              onClick={() => onVoteSuggestion?.(event, 'no')}
            >
              <span className="event-card-vote-btn-icon">
                <XIcon size={18} />
              </span>
              <span className="event-card-vote-btn-label">
                {suggestionType === 'delete' ? 'Keep it' : 'Not worth it'}
              </span>
              <span className="event-card-vote-btn-count">{noVotes}/{totalUsers}</span>
            </button>
          </div>

          <div className="event-card-consensus-track">
            <span className="event-card-consensus-fill" style={consensusFillStyle} />
          </div>
          <p className="event-card-consensus-text">{Math.round(consensusRatio * 100)}% consensus</p>
        </div>
      )}
    </div>
  );
};

export default EventCard;

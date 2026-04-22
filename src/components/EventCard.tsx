import { CSSProperties } from 'react';
import { EVENT_CATEGORY, Event, SuggestionVote } from '../types/event';
import { AppUser } from '../types/auth';
import { CheckIcon, XIcon } from '../services/svgIcons';
import { UserSelection } from '../hooks/useSessionSelections';
import { pickFirstSelector } from '../utilities/pickFirstSelector';
import { getSuggestionVoteSummary } from '../utilities/eventSuggestions';
import { EVENT_TYPE_ICONS } from '../services/eventSvgIcons';
import { resolveEventColor } from '../utilities/eventColors';
import { EventDaySlice } from '../utilities/eventOverlapsDay';
import UserAvatar from './UserAvatar';
import './EventCard.css';

interface EventCardProps {
  event: Event;
  daySlice?: EventDaySlice;
  onSelect?: () => void;
  isSelected?: boolean;
  allSelections?: UserSelection[];
  currentUserId?: string;
  tripUsers?: AppUser[];
  totalTripUsers?: number;
  onVoteSuggestion?: (event: Event, vote: SuggestionVote) => void;
  canApproveSuggestion?: boolean;
  onApproveSuggestion?: (event: Event) => void;
}

const EventCard = ({
  event,
  daySlice,
  onSelect,
  isSelected = false,
  allSelections = [],
  currentUserId,
  tripUsers = [],
  totalTripUsers = 0,
  onVoteSuggestion,
  canApproveSuggestion = false,
  onApproveSuggestion,
}: EventCardProps) => {
  const timeFmt = (d: Date) => new Date(d).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  let time: string;
  if (daySlice?.isAllDay) {
    time = 'All day';
  } else if (daySlice) {
    time = `${timeFmt(daySlice.sliceStart)} – ${timeFmt(daySlice.sliceEnd)}`;
  } else {
    const startTime = timeFmt(event.startDate);
    time = event.endDate ? `${startTime} – ${timeFmt(event.endDate)}` : startTime;
  }

  const showSpanPill = !!daySlice && daySlice.totalDays > 1;
  const displayName = event.name && event.name.trim() ? event.name : '(no name)';
  const colorHex = resolveEventColor(event.color);

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
  const isLodgingMiddleDay = EVENT_CATEGORY[event.type] === 'Lodging'
    && !!daySlice
    && daySlice.totalDays > 2
    && daySlice.dayIndex > 1
    && daySlice.dayIndex < daySlice.totalDays;

  const cardClass = [
    'event-card',
    isSuggestion ? 'event-card--suggestion' : '',
    isSelected ? 'event-card--selected' : '',
    !isSelected && useOtherBorder ? 'event-card--selected-session' : '',
    isLodgingMiddleDay ? 'event-card--lodging-stay' : '',
  ].filter(Boolean).join(' ');
  const cardStyle = (useOtherBorder ? { borderColor: firstOther.color } : undefined) as CSSProperties | undefined;
  const consensusFillStyle = {
    width: `${consensusRatio * 100}%`,
    backgroundColor: leadingVote === 'yes' ? '#2d5a27' : '#b42318',
  };
  const yesStyle = { ['--vote-fill' as string]: `${yesRatio * 100}%` } as CSSProperties;
  const noStyle = { ['--vote-fill' as string]: `${noRatio * 100}%` } as CSSProperties;
  const voteTitle = suggestionType === 'delete' ? 'Vote: should we remove this?' : 'Vote: should we do this?';
  const proposalBadge = suggestionType === 'delete' ? 'Delete Proposal' : 'Proposed';

  const lookupUser = (uid: string): AppUser | null =>
    tripUsers.find(u => u.uid === uid) ?? null;
  const yesVoterUids = event.suggestion?.votes.yes ?? [];
  const noVoterUids = event.suggestion?.votes.no ?? [];
  const approveLabel = suggestionType === 'delete' ? 'Approve deletion' : 'Approve event';

  return (
    <div className={cardClass} style={cardStyle} data-event-id={event.id} onClick={(e) => { e.stopPropagation(); onSelect?.(); }}>
      {colorHex && (
        <span className="event-card-color-stripe" style={{ backgroundColor: colorHex }} aria-hidden="true" />
      )}
      <div className="event-card-header">
        <div className="event-card-body">
          <div className="event-card-time-row">
            <span className="event-card-time">{time}</span>
            {showSpanPill && (
              <span className="event-card-span-pill">Day {daySlice!.dayIndex} of {daySlice!.totalDays}</span>
            )}
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
          <h3 className="event-card-name">{displayName}</h3>
          {event.location && (
            <p className="event-card-meta">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                target="_blank"
                rel="noreferrer"
                className="event-card-location-link"
              >
                {event.location}
              </a>
            </p>
          )}
          {event.cost != null && (
            <p className="event-card-meta">${event.cost.toFixed(2)}</p>
          )}
        </div>
        <div className="event-card-icon">
          {EVENT_TYPE_ICONS[event.type]?.({ size: 24 })}
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
              {yesVoterUids.length > 0 && (
                <span className="event-card-vote-voters" aria-label={`${yesVotes} yes voters`}>
                  {yesVoterUids.map(uid => (
                    <UserAvatar key={uid} user={lookupUser(uid)} size="sm" bordered />
                  ))}
                </span>
              )}
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
              {noVoterUids.length > 0 && (
                <span className="event-card-vote-voters" aria-label={`${noVotes} no voters`}>
                  {noVoterUids.map(uid => (
                    <UserAvatar key={uid} user={lookupUser(uid)} size="sm" bordered />
                  ))}
                </span>
              )}
              <span className="event-card-vote-btn-count">{noVotes}/{totalUsers}</span>
            </button>
          </div>

          {canApproveSuggestion && (
            <button
              type="button"
              className="event-card-approve-btn"
              onClick={() => onApproveSuggestion?.(event)}
            >
              {approveLabel}
            </button>
          )}

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

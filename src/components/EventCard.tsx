import { CSSProperties } from 'react';
import { EVENT_CATEGORY, Event, SuggestionVote } from '../types/event';
import { AppUser } from '../types/auth';
import { EVENT_TYPE_ICONS } from '../services/eventSvgIcons';
import { LocationPinIcon, CheckIcon, XIcon } from '../services/svgIcons';
import { UserSelection } from '../hooks/useSessionSelections';
import { pickFirstSelector } from '../utilities/pickFirstSelector';
import { getSuggestionVoteSummary, getSuggestionVoteThreshold } from '../utilities/eventSuggestions';
import { resolveEventColor } from '../utilities/eventColors';
import { EventDaySlice } from '../utilities/eventOverlapsDay';
import UserAvatar from './UserAvatar';
import './EventCard.css';

interface EventCardProps {
  event: Event;
  daySlice?: EventDaySlice;
  conflictWithEventName?: string | null;
  onSelect?: () => void;
  isSelected?: boolean;
  allSelections?: UserSelection[];
  currentUserId?: string;
  tripUsers?: AppUser[];
  totalTripUsers?: number;
  onVoteSuggestion?: (event: Event, vote: SuggestionVote) => void;
  canApproveSuggestion?: boolean;
  onApproveSuggestion?: (event: Event) => void;
  onDeleteSuggestion?: (event: Event) => void;
}

const EventCard = ({
  event,
  daySlice,
  onSelect,
  isSelected = false,
  allSelections = [],
  conflictWithEventName = null,
  currentUserId,
  tripUsers = [],
  totalTripUsers = 0,
  onVoteSuggestion,
  canApproveSuggestion = false,
  onApproveSuggestion,
  onDeleteSuggestion,
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
  const showVotingUI = isSuggestion && (!daySlice || daySlice.dayIndex === 1);
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
  const isLodgingStayEvent = EVENT_CATEGORY[event.type] === 'Lodging'
    && event.name.includes('(Stay)');

  const cardClass = [
    'event-card',
    isSuggestion && suggestionType !== 'delete' ? 'event-card--suggestion' : '',
    isSuggestion && suggestionType === 'delete' ? 'event-card--suggestion-delete' : '',
    isSelected ? 'event-card--selected' : '',
    !isSelected && useOtherBorder ? 'event-card--selected-session' : '',
    (isLodgingMiddleDay || isLodgingStayEvent) ? 'event-card--lodging-stay' : '',
  ].filter(Boolean).join(' ');
  const cardStyle = (useOtherBorder ? { borderColor: firstOther.color } : undefined) as CSSProperties | undefined;
  // For delete proposals: yes="Remove it" (red), no="Keep it" (green).
  // For create proposals: yes="Count me in" (green), no="Not worth it" (red).
  const consensusFillStyle = {
    width: `${consensusRatio * 100}%`,
    backgroundColor: suggestionType === 'delete'
      ? (leadingVote === 'no' ? '#2d5a27' : '#b42318')
      : (leadingVote === 'yes' ? '#2d5a27' : '#b42318'),
  };
  const yesStyle = { ['--vote-fill' as string]: `${yesRatio * 100}%` } as CSSProperties;
  const noStyle = { ['--vote-fill' as string]: `${noRatio * 100}%` } as CSSProperties;
  const voteTitle = suggestionType === 'delete' ? 'Vote: should we remove this?' : 'Vote: should we do this?';
  const proposalBadge = suggestionType === 'delete' ? 'Delete Proposal' : 'Proposed';

  const selectorAvatars = otherSelectors.length > 0 && (
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
  );

  const lookupUser = (uid: string): AppUser | null =>
    tripUsers.find(u => u.uid === uid) ?? null;
  const yesVoterUids = event.suggestion?.votes.yes ?? [];
  const noVoterUids = event.suggestion?.votes.no ?? [];
  const approveLabel = suggestionType === 'delete' ? 'Approve deletion' : 'Approve event';
  const rejectLabel = suggestionType === 'delete' ? 'Reject deletion' : 'Reject event';
  const voteThreshold = getSuggestionVoteThreshold(totalUsers);
  const canCommunityApproveEvent = yesVotes >= voteThreshold;
  const canCommunityDeleteEvent = noVotes >= voteThreshold;
  const showApproveButton = canApproveSuggestion || canCommunityApproveEvent;

  return (
    <div className={cardClass} style={cardStyle} data-event-id={event.id} onClick={(e) => { e.stopPropagation(); onSelect?.(); }}>
      {colorHex && (
        <span className="event-card-color-stripe" style={{ backgroundColor: colorHex }} aria-hidden="true" />
      )}
      <div className="event-card-header">
        <div className="event-card-body">
          {!daySlice?.isAllDay && (
            <div className="event-card-time-row">
              <span className="event-card-time">{time}</span>
              {conflictWithEventName && (
                <span className="event-card-conflict">
                  Time conflict with "{conflictWithEventName}"
                </span>
              )}
              {showSpanPill && (
                <span className="event-card-span-pill">Day {daySlice!.dayIndex} of {daySlice!.totalDays}</span>
              )}
              {isSuggestion && (
                <span className={`event-card-proposed-badge${suggestionType === 'delete' ? ' event-card-proposed-badge--delete' : ''}`}>{proposalBadge}</span>
              )}
              {selectorAvatars}
            </div>
          )}
          {daySlice?.isAllDay ? (
            <div className="event-card-name-row">
              <h3 className="event-card-name">{displayName}</h3>
              {selectorAvatars}
            </div>
          ) : (
            <h3 className="event-card-name">{displayName}</h3>
          )}
          {event.location && !isLodgingStayEvent && (
            <div className="event-card-location">
              <LocationPinIcon size={16} className={"event-card-location--svg"} />
              <p className="event-card-meta"> {event.location}</p>
            </div>
          )}
          {event.cost != null && (
            <div className="event-card-meta event-card-cost">
              {event.paidBy && (<span className="mr-2">
                <UserAvatar key={event.paidBy} user={tripUsers.find(u => u.uid === event.paidBy) ?? null} size="sm" bordered={true} borderColor='oklch(87.2% 0.01 258.338)' />
              </span>)}
              <span className="dollar-symbol">$</span>
              <p className="cost-value">{event.cost.toFixed(2)}</p>
            </div>
          )}
        </div>
        <div className="event-card-icon">
          {EVENT_TYPE_ICONS[event.type]?.({ size: 24 })}
        </div>
      </div>

      {showVotingUI && (() => {
        // For DELETE proposals, "yes" is destructive (red) and "no" is preserve
        // (green). For CREATE proposals it's the opposite. We render the
        // preserve/positive button first so destructive actions sit below.
        const yesIsDestructive = suggestionType === 'delete';
        const yesBtnTone = yesIsDestructive ? 'event-card-vote-btn--no' : 'event-card-vote-btn--yes';
        const noBtnTone = yesIsDestructive ? 'event-card-vote-btn--yes' : 'event-card-vote-btn--no';

        const yesButton = (
          <button
            type="button"
            className={`event-card-vote-btn ${yesBtnTone}${myVote === 'yes' ? ' event-card-vote-btn--active' : ''}`}
            style={yesStyle}
            onClick={() => onVoteSuggestion?.(event, 'yes')}
          >
            <span className="event-card-vote-btn-icon">
              <CheckIcon size={18} />
            </span>
            <span className="event-card-vote-btn-label">
              {suggestionType === 'delete' ? 'Remove it' : 'Count me in'}
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
        );

        const noButton = (
          <button
            type="button"
            className={`event-card-vote-btn ${noBtnTone}${myVote === 'no' ? ' event-card-vote-btn--active' : ''}`}
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
        );

        // For DELETE proposals: render "Keep it" (no) first, "Remove it" (yes) below.
        // For CREATE proposals: keep yes-on-top.
        const orderedVoteButtons = yesIsDestructive
          ? <>{noButton}{yesButton}</>
          : <>{yesButton}{noButton}</>;

        const approveBtn = (
          <button
            type="button"
            key="approve"
            className={`global-btn ${suggestionType === 'delete' ? 'red-btn' : 'default-btn'} flex-1`}
            onClick={() => suggestionType === 'delete' ? onDeleteSuggestion?.(event) : onApproveSuggestion?.(event)}
          >
            {approveLabel}
          </button>
        );
        const rejectBtn = (
          <button
            type="button"
            key="reject"
            className={`global-btn ${suggestionType === 'delete' ? 'default-btn' : 'red-btn'} flex-1`}
            onClick={() => suggestionType === 'delete' ? onApproveSuggestion?.(event) : onDeleteSuggestion?.(event)}
          >
            {rejectLabel}
          </button>
        );

        // For DELETE proposals: reject (preserve) on left, approve (destructive) on right.
        // For CREATE proposals: approve (positive) on left, reject (destructive) on right.
        const orderedApproveButtons = suggestionType === 'delete'
          ? <>{(canApproveSuggestion || canCommunityDeleteEvent) && rejectBtn}{showApproveButton && approveBtn}</>
          : <>{showApproveButton && approveBtn}{(canApproveSuggestion || canCommunityDeleteEvent) && rejectBtn}</>;

        return (
          <div className="event-card-vote" onClick={(e) => e.stopPropagation()}>
            <p className={`event-card-vote-title${suggestionType === 'delete' ? ' event-card-vote-title--delete' : ''}`}>{voteTitle}</p>

            <div className="event-card-vote-actions">
              {orderedVoteButtons}
            </div>

            {(showApproveButton || canApproveSuggestion || canCommunityDeleteEvent) && (
              <div className="event-card-approve-actions">
                {orderedApproveButtons}
              </div>
            )}

            <div className="event-card-consensus-track">
              <span className="event-card-consensus-fill" style={consensusFillStyle} />
            </div>
            <p className="event-card-consensus-text">{Math.round(consensusRatio * 100)}% consensus</p>
          </div>
        );
      })()}
    </div>
  );
};

export default EventCard;

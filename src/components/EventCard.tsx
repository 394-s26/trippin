import React from 'react';
import { Event } from '../types/event';
import { AppUser } from '../types/auth';
import { EVENT_TYPE_ICONS } from '../services/eventSvgIcons';
import { UserSelection } from '../hooks/useSessionSelections';
import { pickFirstSelector } from '../utilities/pickFirstSelector';
import UserAvatar from './UserAvatar';
import './EventCard.css';

interface EventCardProps {
  event: Event;
  onSelect?: () => void;
  isSelected?: boolean;
  allSelections?: UserSelection[];
  currentUserId?: string;
  tripUsers?: AppUser[];
  heightPx?: number;
}

// Height (px) below which the time pill is hidden to save vertical space.
const TIME_PILL_MIN_HEIGHT = 76;

const EventCard = ({ event, onSelect, isSelected = false, allSelections = [], currentUserId, tripUsers = [], heightPx }: EventCardProps) => {
  const showTime = event.hasTime !== false;
  const timeFmt = (d: Date) => new Date(d).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const startTime = showTime ? timeFmt(event.startDate) : null;
  const time = showTime
    ? (event.endDate ? `${startTime} – ${timeFmt(event.endDate)}` : startTime)
    : null;

  // Hide the time pill when the card is too short to fit it comfortably.
  const showTimePill = time !== null && (heightPx === undefined || heightPx >= TIME_PILL_MIN_HEIGHT);

  const otherSelectors = allSelections.filter(
    s => s.uid !== currentUserId && s.selectedIds.includes(event.id),
  );
  const firstOther = pickFirstSelector(allSelections, event.id, currentUserId);

  const useOtherBorder = !!firstOther && !isSelected;
  const cardClass = isSelected
    ? 'event-card event-card--selected'
    : useOtherBorder
      ? 'event-card event-card--selected-session'
      : 'event-card';

  const cardStyle: React.CSSProperties = {
    ...(useOtherBorder ? { borderColor: firstOther.color } : {}),
    ...(heightPx !== undefined ? { height: '100%', boxSizing: 'border-box', overflow: 'hidden' } : {}),
  };

  return (
    <div className={cardClass} style={cardStyle} data-event-id={event.id} onClick={(e) => { e.stopPropagation(); onSelect?.(); }}>
      <div className="event-card-header">
        <div className="event-card-body">
          <div className="event-card-time-row">
            {showTimePill && <span className="event-card-time">{time}</span>}
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
          {EVENT_TYPE_ICONS[event.type]?.({ size: 24 })}
        </div>
      </div>
    </div>
  );
};

export default EventCard;

import { Event } from '../types/event';
import { AppUser } from '../types/auth';
import { EVENT_TYPE_ICONS } from '../services/eventSvgIcons';
import { LocationPinIcon } from '../services/svgIcons';
import { UserSelection } from '../hooks/useSessionSelections';
import { pickFirstSelector } from '../utilities/pickFirstSelector';
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
}

const EventCard = ({ event, daySlice, onSelect, isSelected = false, allSelections = [], currentUserId, tripUsers = [] }: EventCardProps) => {
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

  const useOtherBorder = !!firstOther && !isSelected;
  const cardClass = isSelected
    ? 'event-card event-card--selected'
    : useOtherBorder
      ? 'event-card event-card--selected-session'
      : 'event-card';
  const cardStyle = useOtherBorder ? { borderColor: firstOther.color } : undefined;

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
    </div>
  );
};

export default EventCard;

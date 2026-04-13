import { ReactElement } from 'react';
import { Event } from '../types/event';
import { AppUser } from '../types/auth';
import { BedIcon, RestaurantIcon, ActivityIcon, FoodIcon } from '../services/svgIcons';
import { UserSelection } from '../hooks/useSessionSelections';
import { pickFirstSelector } from '../utilities/pickFirstSelector';
import UserAvatar from './UserAvatar';
import './EventCard.css';

interface EventCardProps {
  event: Event;
  variant?: 'default' | 'hotel-continuation';
  onSelect?: () => void;
  isSelected?: boolean;
  allSelections?: UserSelection[];
  currentUserId?: string;
  tripUsers?: AppUser[];
}

const TYPE_ICONS: Record<Event['type'], ReactElement> = {
  Hotel: <BedIcon size={24} />,
  Restaurant: <RestaurantIcon size={24} />,
  Activity: <ActivityIcon size={24} />,
  Food: <FoodIcon size={24} />,
};

const formatDateLabel = (date: Date): string =>
  new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

const EventCard = ({ event, variant = 'default', onSelect, isSelected = false, allSelections = [], currentUserId, tripUsers = [] }: EventCardProps) => {
  const timeFmt = (d: Date) => new Date(d).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const startTime = timeFmt(event.startDate);
  const time = event.type === 'Hotel'
    ? event.endDate
      ? `${formatDateLabel(event.startDate)} - ${formatDateLabel(event.endDate)}`
      : formatDateLabel(event.startDate)
    : event.endDate
      ? `${startTime} – ${timeFmt(event.endDate)}`
      : startTime;

  const otherSelectors = allSelections.filter(
    s => s.uid !== currentUserId && s.selectedIds.includes(event.id),
  );
  const firstOther = pickFirstSelector(allSelections, event.id, currentUserId);

  const useOtherBorder = !!firstOther && !isSelected;
  const variantClass = variant === 'hotel-continuation' ? ' event-card--hotel-continuation' : '';
  const cardClass = isSelected
    ? `event-card event-card--selected${variantClass}`
    : useOtherBorder
      ? `event-card event-card--selected-session${variantClass}`
      : `event-card${variantClass}`;
  const cardStyle = useOtherBorder ? { borderColor: firstOther.color } : undefined;

  if (variant === 'hotel-continuation') {
    return (
      <div className={cardClass} style={cardStyle} onClick={onSelect}>
        <div className="event-card-continuation">
          <div className="event-card-continuation-main">
            <span className="event-card-continuation-icon">
              {TYPE_ICONS[event.type]}
            </span>
            <div className="event-card-continuation-copy">
              <h3 className="event-card-name">{event.name}</h3>
              <p className="event-card-meta">Stay continues</p>
            </div>
          </div>
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
      </div>
    );
  }

  return (
    <div className={cardClass} style={cardStyle} onClick={onSelect}>
      <div className="event-card-header">
        <div className="event-card-body">
          <div className="event-card-time-row">
            <span className="event-card-time">{time}</span>
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
    </div>
  );
};

export default EventCard;

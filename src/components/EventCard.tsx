import { ReactElement } from 'react';
import { Event } from '../types/event';
import { BedIcon, RestaurantIcon, ActivityIcon, FoodIcon, PencilIcon, TrashIcon } from '../services/svgIcons';
import { UserSelection } from '../hooks/useSessionSelections';
import './EventCard.css';

interface EventCardProps {
  event: Event;
  onEdit: () => void;
  onDelete: () => void;
  onSelect?: () => void;
  isSelected?: boolean;
  allSelections?: UserSelection[];
  currentUserId?: string;
}

const TYPE_ICONS: Record<Event['type'], ReactElement> = {
  Hotel: <BedIcon size={24} />,
  Restaurant: <RestaurantIcon size={24} />,
  Activity: <ActivityIcon size={24} />,
  Food: <FoodIcon size={24} />,
};

const EventCard = ({ event, onEdit, onDelete, onSelect, isSelected = false, allSelections = [], currentUserId }: EventCardProps) => {
  const time = new Date(event.date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const selectors = allSelections.filter(s => s.selectedIds.includes(event.id));

  return (
    <div className={`event-card${isSelected ? ' event-card--selected' : ''}`} onClick={onSelect}>
      <div className="event-card-header">
        <div className="event-card-body">
          <div className="event-card-time-row">
            <span className="event-card-time">{time}</span>
            {selectors.length > 0 && (
              <div className="event-card-selectors">
                {selectors.map(s => (
                  <span
                    key={s.uid}
                    className={`event-card-selector-dot${s.uid === currentUserId ? ' event-card-selector-dot--me' : ''}`}
                    style={{ backgroundColor: s.color }}
                    title={s.uid === currentUserId ? 'You' : undefined}
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
      <div className="event-card-actions">
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="event-card-edit-btn">
          <PencilIcon />
          Edit
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="event-card-delete-btn">
          <TrashIcon />
          Delete
        </button>
      </div>
    </div>
  );
};

export default EventCard;

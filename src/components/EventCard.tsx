import { ReactElement } from 'react';
import { Event } from '../types/event';
import { BedIcon, RestaurantIcon, ActivityIcon, FoodIcon, PencilIcon, TrashIcon } from '../services/svgIcons';
import './EventCard.css';

interface EventCardProps {
  event: Event;
  onEdit: () => void;
  onDelete: () => void;
}

const TYPE_ICONS: Record<Event['type'], ReactElement> = {
  Hotel: <BedIcon size={24} />,
  Restaurant: <RestaurantIcon size={24} />,
  Activity: <ActivityIcon size={24} />,
  Food: <FoodIcon size={24} />,
};

const EventCard = ({ event, onEdit, onDelete }: EventCardProps) => {
  const time = new Date(event.date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="event-card">
      <div className="event-card-header">
        <div className="event-card-body">
          <div className="event-card-time-row">
            <span className="event-card-time">{time}</span>
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
        <button onClick={onEdit} className="event-card-edit-btn">
          <PencilIcon />
          Edit
        </button>
        <button onClick={onDelete} className="event-card-delete-btn">
          <TrashIcon />
          Delete
        </button>
      </div>
    </div>
  );
};

export default EventCard;

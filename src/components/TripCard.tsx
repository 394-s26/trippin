import { Timestamp } from 'firebase/firestore';
import { Trip } from '../types/trip';
import useDays from '../hooks/useDays';
import useItinerary from '../hooks/useItinerary';
import greenBg from '../images/green_bg.jpg';
import { toDate } from '../utilities/timestamps';
import './TripCard.css';

interface TripCardProps {
  trip: Trip;
  onClick?: () => void;
}

export default function TripCard({ trip, onClick }: TripCardProps) {
  const { days } = useDays(trip.id);
  const { events } = useItinerary(trip.id);

  const startDate = toDate(trip.startDate as Date | Timestamp);
  const endDate = days.length > 0
    ? new Date(startDate.getTime() + (days.length - 1) * 86400000)
    : null;

  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dateRange = endDate
    ? `${fmt(startDate)} – ${fmt(endDate)}`
    : fmt(startDate);

  return (
    <div
      className="trip-card"
      onClick={onClick}
      style={{ backgroundImage: `url(${trip.bannerImageUrl ?? greenBg})` }}
    >
      <div className="trip-card-overlay" />
      <div className="trip-card-content">
        <h2 className="trip-card-name">{trip.name}</h2>
        <p className="trip-card-date">{dateRange}</p>
        <p className="trip-card-meta">
          {days.length} {days.length === 1 ? 'day' : 'days'} · {events.length} {events.length === 1 ? 'event' : 'events'}
        </p>
      </div>
    </div>
  );
}

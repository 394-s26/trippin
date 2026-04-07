import { useRef, useState, useEffect, useCallback } from 'react';
import { Trip } from '../types/trip';
import TripCard from './TripCard';
import './TripScroller.css';

interface TripScrollerProps {
  trips: Trip[];
  onTripClick: (tripId: string) => void;
}

export default function TripScroller({ trips, onTripClick }: TripScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const canScroll = el.scrollWidth > el.clientWidth;
    setIsScrollable(canScroll);
    setAtStart(el.scrollLeft <= 0);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState);
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [trips, updateScrollState]);

  const scroll = (direction: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  if (trips.length === 0) return null;

  return (
    <div className="trip-scroller">
      {isScrollable && (
        <button
          className="trip-scroller-arrow"
          onClick={() => scroll('left')}
          disabled={atStart}
          aria-label="Scroll left"
        >
          ‹
        </button>
      )}
      <div className="trip-scroller-track" ref={scrollRef}>
        {trips.map(trip => (
          <TripCard key={trip.id} trip={trip} onClick={() => onTripClick(trip.id)} />
        ))}
      </div>
      {isScrollable && (
        <button
          className="trip-scroller-arrow"
          onClick={() => scroll('right')}
          disabled={atEnd}
          aria-label="Scroll right"
        >
          ›
        </button>
      )}
    </div>
  );
}

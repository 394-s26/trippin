import { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { subscribeToEvents } from '../services/firestoreEventsService';
import { Event } from '../types/event';
import { toDate } from '../utilities/timestamps';

const useItinerary = (tripId: string) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToEvents(tripId, (fetchedEvents) => {
      const converted = fetchedEvents.map(e => ({
        ...e,
        date: toDate(e.date as Date | Timestamp),
      }));
      setEvents(converted);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tripId]);

  return { events, loading, error };
};

export default useItinerary;

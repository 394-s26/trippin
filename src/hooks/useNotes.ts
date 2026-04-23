import { useEffect, useState } from 'react';
import { subscribeToNotes, TripNotes } from '../services/firestoreMiscService';

const useNotes = (tripId: string) => {
  const [notes, setNotes] = useState<TripNotes | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToNotes(tripId, (next) => {
      setNotes(next);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tripId]);

  return { notes, loading };
};

export default useNotes;

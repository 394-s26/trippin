import { useEffect, useState } from 'react';
import { subscribeToTripGame, TripGame } from '../services/firestoreMiscService';

const useTripGame = (tripId: string) => {
  const [game, setGame] = useState<TripGame | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToTripGame(tripId, (next) => {
      setGame(next);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tripId]);

  return { game, loading };
};

export default useTripGame;

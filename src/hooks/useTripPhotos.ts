import { useEffect, useState } from 'react';
import { subscribeToTripPhotos, TripPhoto } from '../services/firestoreMiscService';

const useTripPhotos = (tripId: string) => {
  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToTripPhotos(tripId, (next) => {
      setPhotos(next);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tripId]);

  return { photos, loading };
};

export default useTripPhotos;

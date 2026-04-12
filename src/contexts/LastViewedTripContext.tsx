import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { LastViewedTrip } from '../types/trip';
import { updateLastViewedTrip, subscribeToLastViewedTrip } from '../services/firestoreTripService';
import { useAuth } from './AuthContext';

interface LastViewedTripContextType {
  lastViewedTrip: LastViewedTrip | null;
  setLastViewedTrip: (trip: LastViewedTrip) => Promise<void>;
}

const LastViewedTripContext = createContext<LastViewedTripContextType | null>(null);

export const LastViewedTripProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [lastViewedTrip, setLastViewedTripState] = useState<LastViewedTrip | null>(null);

  useEffect(() => {
    if (!user) {
      setLastViewedTripState(null);
      return;
    }

    const unsub = subscribeToLastViewedTrip(user.uid, (data) => {
      setLastViewedTripState(data);
    });

    return () => unsub();
  }, [user]);

  const setLastViewedTrip = async (trip: LastViewedTrip) => {
    if (!user) return;
    setLastViewedTripState(trip);
    try {
      await updateLastViewedTrip(user.uid, trip);
    } catch (error) {
      console.error('Failed to persist last viewed trip:', error);
    }
  };

  return (
    <LastViewedTripContext.Provider value={{ lastViewedTrip, setLastViewedTrip }}>
      {children}
    </LastViewedTripContext.Provider>
  );
};

export const useLastViewedTrip = () => {
  const ctx = useContext(LastViewedTripContext);
  if (!ctx) throw new Error('useLastViewedTrip must be used inside LastViewedTripProvider');
  return ctx;
};

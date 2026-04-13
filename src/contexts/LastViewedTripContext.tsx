import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { LastViewedTrip } from '../types/trip';
import {
  updateLastViewedTrip,
  subscribeToLastViewedTrip,
  clearLastViewedTrip,
  subscribeToTrips,
} from '../services/firestoreTripService';
import { useAuth } from './AuthContext';

interface LastViewedTripContextType {
  lastViewedTrip: LastViewedTrip | null;
  setLastViewedTrip: (trip: LastViewedTrip) => Promise<void>;
}

const LastViewedTripContext = createContext<LastViewedTripContextType | null>(null);

export const LastViewedTripProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [lastViewedTrip, setLastViewedTripState] = useState<LastViewedTrip | null>(null);
  const [accessibleTripIds, setAccessibleTripIds] = useState<Set<string>>(new Set());
  const [tripsLoaded, setTripsLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setLastViewedTripState(null);
      setAccessibleTripIds(new Set());
      setTripsLoaded(false);
      return;
    }

    const unsubProfile = subscribeToLastViewedTrip(user.uid, (data) => {
      setLastViewedTripState(data);
    });

    const unsubTrips = subscribeToTrips(user.uid, (trips) => {
      setAccessibleTripIds(new Set(trips.map(t => t.id)));
      setTripsLoaded(true);
    });

    return () => {
      unsubProfile();
      unsubTrips();
    };
  }, [user]);

  // Clear stale lastViewedTrip when the referenced trip no longer exists.
  useEffect(() => {
    if (!user || !tripsLoaded || !lastViewedTrip) return;
    if (!accessibleTripIds.has(lastViewedTrip.tripId)) {
      setLastViewedTripState(null);
      clearLastViewedTrip(user.uid);
    }
  }, [user, tripsLoaded, lastViewedTrip, accessibleTripIds]);

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

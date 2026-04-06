import { useState, useEffect } from 'react';
import { subscribeToTrips } from '../services/firestoreTripService';
import { Trip } from '../types/trip';


const useTrips = (userId: string) => {

    const [trips, setTrips] = useState<Trip[]>([]);
    const [loading, setLoading] = useState(true);
    // const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = subscribeToTrips(userId, (trips) => {
            setTrips(trips);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    return { trips, loading };

}

export default useTrips;

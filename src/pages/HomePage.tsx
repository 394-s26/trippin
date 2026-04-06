import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import TripScroller from '../components/TripScroller';
import { createTrip } from '../services/firestoreTripService';
import useTrips  from '../hooks/useTrips';
import { useAuth } from '../contexts/AuthContext';
import intoNight from '../images/into-night.svg';
import withFriends from '../images/with-friends.svg';
import './HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);

  const { trips, loading } = useTrips(user!.uid);
  const myTrips = trips.filter(t => t.userId === user!.uid);
  const sharedTrips = trips.filter(t => t.shared?.includes(user!.uid));

  const handleNewTrip = async () => {
    setCreating(true);
    try {
      const id = await createTrip({
        userId: user!.uid,
        name: 'New Trip',
        startDate: new Date(),
        budget: 0,
        bannerImageUrl: null,
        shared: [],
      });
      navigate(`/trip/${id}`);
    } catch (err) {
      console.error('Failed to create trip:', err);
      setCreating(false);
    }
  };

  return (
    <div className="home-page-wrapper">
      <div className="home-page-container">
        <AppHeader />
        <main className="home-page-main">
          <div className="home-page-section">
            <div className="home-page-section-header">
              <h2 className="home-page-section-title">My Trips</h2>
              {!loading && myTrips.length > 0 && (
                <button
                  className="home-page-new-trip-btn"
                  onClick={handleNewTrip}
                  disabled={creating}
                >
                  {creating ? 'Creating…' : '+ New Trip'}
                </button>
              )}
            </div>
            {!loading && myTrips.length === 0 && (
              <div className="home-page-empty">
                <img src={intoNight} alt="No trips yet" className="home-page-empty-img" />
                <p>No trips yet...</p>
                <button
                  className="home-page-new-trip-btn"
                  onClick={handleNewTrip}
                  disabled={creating}
                >
                  {creating ? 'Creating…' : 'Create one to get started!'}
                </button>
              </div>
            )}
            <TripScroller trips={myTrips} onTripClick={(id) => navigate(`/trip/${id}`)} />
          </div>

          <div className="home-page-section">
            <h2 className="home-page-section-title">Shared with me</h2>
            {!loading && sharedTrips.length === 0 && (
              <div className="home-page-empty">
                <img src={withFriends} alt="No shared trips" className="home-page-empty-img" />
                <p>No one's shared any trips with you ):</p>
              </div>
            )}
            <TripScroller trips={sharedTrips} onTripClick={(id) => navigate(`/trip/${id}`)} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default HomePage;

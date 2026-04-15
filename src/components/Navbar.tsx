import { useState } from 'react';
import { NavLink, useMatch, useNavigate } from 'react-router-dom';
import { HomeIcon, MapIcon, BookTextIcon, PlusIcon } from '../services/svgIcons';
import { useAuth } from '../contexts/AuthContext';
import { useLastViewedTrip } from '../contexts/LastViewedTripContext';
import { createTrip } from '../services/firestoreTripService';
import NewTripModal from './NewTripModal';
import UserAvatar from './UserAvatar';
import './Navbar.css';

const Navbar = () => {
  const { user, appUser } = useAuth();
  const { lastViewedTrip } = useLastViewedTrip();
  const navigate = useNavigate();
  const tripMatch = useMatch('/trip/:id/*');
  const isOnTripPage = !!tripMatch;
  const activeTripId = tripMatch?.params.id ?? lastViewedTrip?.tripId;

  const [showNewTrip, setShowNewTrip] = useState(false);
  const [creating, setCreating] = useState(false);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `navbar-link ${isActive ? 'navbar-link-active' : ''}`;

  const handleCreateTrip = async (name: string, startDate: Date, endDate: Date) => {
    if (!user) return;
    setCreating(true);
    try {
      const id = await createTrip(user.uid, {
        userId: user.uid,
        name,
        startDate,
        endDate,
        budget: 0,
        bannerImageUrl: null,
        shared: [],
        permissions: {},
      });
      setShowNewTrip(false);
      navigate(`/trip/${id}`);
    } catch (err) {
      console.error('Failed to create trip:', err);
    } finally {
      setCreating(false);
    }
  };

  const groupClass = `navbar-trip-group ${isOnTripPage ? 'navbar-trip-group-expanded' : 'navbar-trip-group-collapsed'}`;

  return (
    <>
      <nav className="navbar">
        <NavLink to="/" end className={linkClass}>
          <HomeIcon size={20} />
          <span>Home</span>
        </NavLink>

        <div className={groupClass}>
          <div className={`navbar-side-btn navbar-side-btn-left ${isOnTripPage && activeTripId ? 'navbar-side-btn-visible' : ''}`}>
            {activeTripId && (
              <NavLink to={`/trip/${activeTripId}/map`} className={linkClass}>
                <MapIcon size={20} />
                <span>Map</span>
              </NavLink>
            )}
          </div>

          {lastViewedTrip ? (
            <NavLink
              to={`/trip/${lastViewedTrip.tripId}`}
              end
              className={({ isActive }) =>
                `navbar-link navbar-trip-btn ${isActive ? 'navbar-link-active' : ''}`
              }
            >
              <div className="navbar-trip-circle-wrapper">
                <div
                  className={`navbar-trip-circle ${!isOnTripPage ? 'navbar-trip-circle-solo' : ''}`}
                  style={
                    lastViewedTrip.bannerImageUrl
                      ? { backgroundImage: `url(${lastViewedTrip.bannerImageUrl})` }
                      : undefined
                  }
                />
                <span className="navbar-trip-name">{"Recent"}</span>
              </div>
            </NavLink>
          ) : (
            <button
              className="navbar-link navbar-trip-btn"
              onClick={() => setShowNewTrip(true)}
            >
              <div className="navbar-trip-circle-wrapper">
                <div className={`navbar-trip-circle navbar-trip-circle-new ${!isOnTripPage ? 'navbar-trip-circle-solo' : ''}`}>
                  <PlusIcon size={24} />
                </div>
                <span className="navbar-trip-name">New Trip</span>
              </div>
            </button>
          )}

          <div className={`navbar-side-btn navbar-side-btn-right ${isOnTripPage && activeTripId ? 'navbar-side-btn-visible' : ''}`}>
            {activeTripId && (
              <NavLink to={`/trip/${activeTripId}/misc`} className={linkClass}>
                <BookTextIcon size={20} />
                <span>Misc</span>
              </NavLink>
            )}
          </div>
        </div>

        <NavLink to="/profile" className={linkClass}>
          <UserAvatar user={appUser} size="sm" />
          <span>Profile</span>
        </NavLink>
      </nav>

      <NewTripModal
        isOpen={showNewTrip}
        onClose={() => setShowNewTrip(false)}
        onSubmit={handleCreateTrip}
        submitting={creating}
      />
    </>
  );
};

export default Navbar;

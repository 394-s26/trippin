import { NavLink, useMatch } from 'react-router-dom';
import { HomeIcon, MapIcon, BookTextIcon } from '../services/svgIcons';
import { useAuth } from '../contexts/AuthContext';
import { useLastViewedTrip } from '../contexts/LastViewedTripContext';
import UserAvatar from './UserAvatar';
import './Navbar.css';

const Navbar = () => {
  const { appUser } = useAuth();
  const { lastViewedTrip } = useLastViewedTrip();
  const tripMatch = useMatch('/trip/:id/*');
  const isOnTripPage = !!tripMatch;
  const activeTripId = tripMatch?.params.id ?? lastViewedTrip?.tripId;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `navbar-link ${isActive ? 'navbar-link-active' : ''}`;

  return (
    <nav className="navbar">
      <NavLink to="/" end className={linkClass}>
        <HomeIcon size={20} />
        <span>Home</span>
      </NavLink>

      <div className="navbar-trip-group">
        {isOnTripPage && activeTripId && (
          <NavLink to={`/trip/${activeTripId}/map`} className={linkClass}>
            <MapIcon size={20} />
            <span>Map</span>
          </NavLink>
        )}

        {lastViewedTrip && (
          <NavLink
            to={`/trip/${lastViewedTrip.tripId}`}
            end
            className={({ isActive }) =>
              `navbar-link navbar-trip-btn ${isActive ? 'navbar-link-active' : ''}`
            }
          >
            <div className="navbar-trip-circle-wrapper">
              <span className="navbar-trip-name">{lastViewedTrip.tripName}</span>
              <div
                className="navbar-trip-circle"
                style={
                  lastViewedTrip.bannerImageUrl
                    ? { backgroundImage: `url(${lastViewedTrip.bannerImageUrl})` }
                    : undefined
                }
              />
            </div>
          </NavLink>
        )}

        {isOnTripPage && activeTripId && (
          <NavLink to={`/trip/${activeTripId}/misc`} className={linkClass}>
            <BookTextIcon size={20} />
            <span>Misc</span>
          </NavLink>
        )}
      </div>

      <NavLink to="/profile" className={linkClass}>
        <UserAvatar user={appUser} size="sm" />
        <span>Profile</span>
      </NavLink>
    </nav>
  );
};

export default Navbar;

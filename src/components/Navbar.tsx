import { NavLink } from 'react-router-dom';
import { HomeIcon } from '../services/svgIcons';
import { useAuth } from '../contexts/AuthContext';
import UserAvatar from './UserAvatar';
import './Navbar.css';

const Navbar = () => {
  const { appUser } = useAuth();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `navbar-link ${isActive ? 'navbar-link-active' : ''}`;

  return (
    <nav className="navbar">
      <NavLink to="/" end className={linkClass}>
        <HomeIcon />
        <span>Home</span>
      </NavLink>

      <NavLink to="/profile" className={linkClass}>
        <UserAvatar user={appUser} size="lg" />
        <span>Profile</span>
      </NavLink>
    </nav>
  );
};

export default Navbar;

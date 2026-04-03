import { NavLink } from 'react-router-dom';
import { HomeIcon, SearchIcon, UserIcon } from '../services/svgIcons';
import './Navbar.css';

const Navbar = () => {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `navbar-link ${isActive ? 'navbar-link-active' : ''}`;

  return (
    <nav className="navbar">
      <NavLink to="/" end className={linkClass}>
        <HomeIcon />
        <span>Home</span>
      </NavLink>

      <NavLink to="/profile" className={linkClass}>
        <UserIcon />
        <span>Profile</span>
      </NavLink>
    </nav>
  );
};

export default Navbar;

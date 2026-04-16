import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserIcon } from '../services/svgIcons';
import trippinBird from '../images/trippinBird.png';
import { useAuth } from '../contexts/AuthContext';
import './AppHeader.css';

const AppHeader = () => {
  const { appUser, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="app-header">
      <Link to="/" className="app-header-logo">
        <img src={trippinBird} alt="" className="app-header-logo-img" />
        <span className="app-header-logo-text">Trippin'</span>
      </Link>
      <div className="app-header-profile-wrapper" ref={menuRef}>
        <button
          aria-label="User profile"
          className="app-header-profile-btn"
          onClick={() => setMenuOpen(prev => !prev)}
        >
          {appUser?.photoURL
            ? <img src={appUser.photoURL} alt={appUser.firstName} className="app-header-avatar" />
            : <UserIcon size={22} />
          }
        </button>
        {menuOpen && (
          <div className="app-header-submenu">
            <span className="app-header-submenu-username">@{appUser?.username}</span>
            <button className="app-header-submenu-item" disabled>Profile</button>
            <button className="app-header-submenu-item app-header-submenu-logout" onClick={() => { logout(); setMenuOpen(false); }}>Log out</button>
          </div>
        )}
      </div>
    </header>
  );
};

export default AppHeader;

import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink } from 'react-router-dom';
import api from '../api/client';
import { logout } from '../redux/authSlice';
import './Navbar.css';

const Navbar = () => {
  const dispatch = useDispatch();
  const { user, token } = useSelector((state) => state.auth);
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const publicLinks = [
    { to: '/', label: 'Home' },
  ];
  const authLinks = token
    ? [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/stocks', label: 'Stocks' },
        { to: '/trade', label: 'Trade' },
        { to: '/portfolio', label: 'Portfolio' },
        { to: '/watchlist', label: 'Watchlist' },
      ]
    : [
        { to: '/login', label: 'Login' },
        { to: '/register', label: 'Register' },
      ];

  if (token && user?.role === 'admin') {
    authLinks.push({ to: '/admin/stocks', label: 'Admin Stocks' });
  }

  const links = [...publicLinks, ...authLinks];

  const profileFeatures = useMemo(() => {
    if (!token) {
      return [];
    }

    const features = [
      { to: '/dashboard', label: 'Overview', hint: 'Snapshot of your account' },
      { to: '/portfolio', label: 'Portfolio', hint: 'View holdings and total P&L' },
      { to: '/watchlist', label: 'Watchlist', hint: 'Track symbols you follow' },
      { to: '/trade', label: 'Trade Desk', hint: 'Place and review your orders' },
      { to: '/stocks', label: 'Market Explorer', hint: 'Browse live market quotes' },
      { to: '/', label: 'Home Feed', hint: 'Latest platform updates' },
    ];

    if (user?.role === 'admin') {
      features[5] = {
        to: '/admin/stocks',
        label: 'Admin Stocks',
        hint: 'Manage stock catalog entries',
      };
    }

    return features;
  }, [token, user?.role]);

  const profileName = user?.name || user?.email || 'User';
  const profileInitial = profileName.trim().charAt(0).toUpperCase();
  const profileMeta = user?.role === 'admin' ? 'Administrator' : 'Trader';

  useEffect(() => {
    if (!isProfileOpen) {
      return undefined;
    }

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [isProfileOpen]);

  useEffect(() => {
    if (!token) {
      setIsProfileOpen(false);
    }
  }, [token]);

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (_error) {
      // Local logout should still proceed if server logout fails.
    }
    dispatch(logout());
    setIsOpen(false);
    setIsProfileOpen(false);
  };

  return (
    <header className="navbar-shell">
      <nav className="navbar">
        <NavLink to="/" className="navbar-brand" onClick={() => setIsOpen(false)}>
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64" className="brand-mark-icon" role="img">
              <defs>
                <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0e3a5d" />
                  <stop offset="100%" stopColor="#2eb5d3" />
                </linearGradient>
              </defs>
              <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#brandGradient)" />
              <path
                d="M12 42L24 30L34 37L50 21"
                fill="none"
                stroke="#f5fcff"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M44 21H50V27"
                fill="none"
                stroke="#f5fcff"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M12 50H52" fill="none" stroke="#d6f5ff" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </span>
          <span className="brand-copy">
            <strong>GrowUp</strong>
            <small>Growth Trading Lab</small>
          </span>
        </NavLink>

        <div className="navbar-right">
          <button
            className={`nav-toggle ${isOpen ? 'active' : ''}`}
            type="button"
            onClick={() => {
              setIsOpen((prev) => !prev);
              setIsProfileOpen(false);
            }}
            aria-label="Toggle navigation menu"
            aria-expanded={isOpen}
          >
            <span />
            <span />
            <span />
          </button>

          <ul className={`navbar-links ${isOpen ? 'open' : ''}`}>
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setIsOpen(false);
                    setIsProfileOpen(false);
                  }}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
            {token ? (
              <li>
                <button
                  type="button"
                  className="nav-link"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </li>
            ) : null}
          </ul>

          {token ? (
            <button
              type="button"
              className={`profile-trigger ${isProfileOpen ? 'active' : ''}`}
              onClick={() => {
                setIsProfileOpen((prev) => !prev);
                setIsOpen(false);
              }}
              aria-expanded={isProfileOpen}
              aria-label="Toggle profile sidebar"
            >
              <span className="profile-avatar" aria-hidden="true">{profileInitial}</span>
              <span className="profile-trigger-copy">
                <strong>{profileName}</strong>
                <small>{profileMeta}</small>
              </span>
            </button>
          ) : null}
        </div>
      </nav>

      {token ? (
        <>
          <button
            type="button"
            className={`profile-backdrop ${isProfileOpen ? 'open' : ''}`}
            onClick={() => setIsProfileOpen(false)}
            aria-label="Close profile sidebar"
          />

          <aside
            className={`profile-sidebar ${isProfileOpen ? 'open' : ''}`}
            aria-hidden={!isProfileOpen}
          >
            <div className="profile-sidebar-header">
              <div className="profile-sidebar-user">
                <span className="profile-avatar large" aria-hidden="true">{profileInitial}</span>
                <div className="profile-sidebar-copy">
                  <strong>{profileName}</strong>
                  <span>{user?.email}</span>
                </div>
              </div>
              <button
                type="button"
                className="profile-close"
                onClick={() => setIsProfileOpen(false)}
                aria-label="Close profile sidebar"
              >
                x
              </button>
            </div>

            <ul className="profile-feature-list">
              {profileFeatures.map((feature) => (
                <li key={feature.to}>
                  <NavLink
                    to={feature.to}
                    className={({ isActive }) => `profile-feature ${isActive ? 'active' : ''}`}
                    onClick={() => setIsProfileOpen(false)}
                  >
                    <span>{feature.label}</span>
                    <small>{feature.hint}</small>
                  </NavLink>
                </li>
              ))}
            </ul>

            <button type="button" className="profile-signout" onClick={handleLogout}>
              Sign Out
            </button>
          </aside>
        </>
      ) : null}
    </header>
  );
};

export default Navbar;

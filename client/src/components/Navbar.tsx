/**
 * Navbar – sticky top navigation with theme toggle, mobile menu
 */

import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

const NAV_LINKS = [
  { to: '/theory', label: 'Theory' },
  { to: '/simulator', label: 'Simulator' },
  { to: '/observations', label: 'Observations' },
  { to: '/graphs', label: 'Graphs' },
  { to: '/quiz', label: 'Quiz' },
  { to: '/report', label: 'Report' },
];

export default function Navbar() {
  const { user, logout, toggleTheme, theme } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/');
    setMenuOpen(false);
  };

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2 no-underline" aria-label="Virtual Mechanics Lab Home">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-glow">
            <span className="text-black text-sm font-bold" style={{ fontFamily: 'Anton, sans-serif' }}>⚙</span>
          </div>
          <span className="hidden sm:block font-heading text-lg gradient-text">VML · Exp 5</span>
        </NavLink>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
          {user?.role === 'TEACHER' || user?.role === 'ADMIN' ? (
            <NavLink
              to="/teacher"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              Teacher
            </NavLink>
          ) : null}
          {user?.role === 'ADMIN' ? (
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              Admin
            </NavLink>
          ) : null}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="btn btn-ghost btn-sm"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* Auth buttons */}
          {user ? (
            <div className="hidden md:flex items-center gap-2">
              <span className="text-sm text-text-secondary">{user.name.split(' ')[0]}</span>
              <span
                className={`badge ${user.role === 'ADMIN' ? 'badge-danger' : user.role === 'TEACHER' ? 'badge-info' : 'badge-neutral'}`}
              >
                {user.role}
              </span>
              <button onClick={handleLogout} className="btn btn-ghost btn-sm">
                Logout
              </button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <NavLink to="/login" className="btn btn-ghost btn-sm">Login</NavLink>
              <NavLink to="/register" className="btn btn-primary btn-sm">Register</NavLink>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            className="md:hidden btn btn-ghost btn-sm"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle mobile menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border animate-fade-in">
          <div className="px-4 py-3 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                {link.label}
              </NavLink>
            ))}
            {user ? (
              <>
                <div className="section-divider my-1" />
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="text-sm">{user.name}</span>
                  <span className={`badge ${user.role === 'ADMIN' ? 'badge-danger' : 'badge-neutral'}`}>
                    {user.role}
                  </span>
                </div>
                <button onClick={handleLogout} className="btn btn-ghost btn-sm w-full justify-start">
                  Logout
                </button>
              </>
            ) : (
              <>
                <div className="section-divider my-1" />
                <NavLink to="/login" onClick={() => setMenuOpen(false)} className="btn btn-ghost btn-sm">Login</NavLink>
                <NavLink to="/register" onClick={() => setMenuOpen(false)} className="btn btn-primary btn-sm">Register</NavLink>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { Terminal, LogOut, RefreshCw, BarChart2, BookOpen, Menu, X, Calendar } from "lucide-react";
import { Logo } from "./Logo";

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.contests.sync();
      alert("Manual sync triggered! Contests are updating in the background. Please refresh in a moment.");
    } catch (e) {
      alert("Sync failed: " + e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <header className="navbar-header">
      <div className="container navbar-container">
        <Link to="/" className="nav-logo" onClick={() => setMobileMenuOpen(false)} style={{ gap: "0.8rem" }}>
          <Logo size={26} />
          <span style={{ letterSpacing: "-0.01em" }}>Code<span style={{ color: "var(--color-primary)", fontWeight: "800" }}>Verse</span></span>
        </Link>

        {/* Mobile menu toggle */}
        <button 
          className="mobile-nav-toggle" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Desktop Navigation Links */}
        {user ? (
          <nav className="nav-links">
            <NavLink to="/" end className={({ isActive }) => `nav-link flex-center ${isActive ? 'active' : ''}`} style={{ gap: '0.4rem' }}>
              <BarChart2 size={16} /> Dashboard
            </NavLink>
            <NavLink to="/contests" className={({ isActive }) => `nav-link flex-center ${isActive ? 'active' : ''}`} style={{ gap: '0.4rem' }}>
              <BookOpen size={16} /> Contests
            </NavLink>
            <NavLink to="/upcoming" className={({ isActive }) => `nav-link flex-center ${isActive ? 'active' : ''}`} style={{ gap: '0.4rem' }}>
              <Calendar size={16} /> Calendar
            </NavLink>
            
            <button 
              onClick={handleSync} 
              disabled={syncing}
              className="btn btn-secondary flex-center"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", gap: "0.4rem" }}
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync Contests"}
            </button>

            <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Hi, <span style={{ color: "var(--text-main)", fontWeight: "600" }}>{user.username}</span>
            </span>

            <button 
              onClick={handleLogout} 
              className="btn btn-secondary flex-center"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", gap: "0.4rem", color: "#f87171" }}
            >
              <LogOut size={14} />
              Logout
            </button>
          </nav>
        ) : (
          <nav className="nav-links">
            <Link to="/login" className="nav-link">Login</Link>
            <Link to="/signup" className="btn btn-primary" style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}>Sign Up</Link>
          </nav>
        )}
      </div>

      {/* Mobile Navigation Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="mobile-nav-menu">
          {user ? (
            <>
              <NavLink 
                to="/" 
                end 
                className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                onClick={() => setMobileMenuOpen(false)}
              >
                <BarChart2 size={16} /> Dashboard
              </NavLink>
              <NavLink 
                to="/contests" 
                className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                onClick={() => setMobileMenuOpen(false)}
              >
                <BookOpen size={16} /> Contests
              </NavLink>
              <NavLink 
                to="/upcoming" 
                className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                onClick={() => setMobileMenuOpen(false)}
              >
                <Calendar size={16} /> Calendar
              </NavLink>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  Hi, <span style={{ color: "var(--text-main)", fontWeight: "600" }}>{user.username}</span>
                </span>
                
                <button 
                  onClick={() => { handleSync(); setMobileMenuOpen(false); }} 
                  disabled={syncing}
                  className="btn btn-secondary flex-center"
                  style={{ width: "100%", padding: "0.6rem 1rem", fontSize: "0.85rem", gap: "0.4rem" }}
                >
                  <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                  {syncing ? "Syncing..." : "Sync Contests"}
                </button>

                <button 
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }} 
                  className="btn btn-secondary flex-center"
                  style={{ width: "100%", padding: "0.6rem 1rem", fontSize: "0.85rem", gap: "0.4rem", color: "#f87171" }}
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>Login</Link>
              <Link to="/signup" className="btn btn-primary" style={{ width: "100%", padding: "0.6rem 1rem", fontSize: "0.85rem" }} onClick={() => setMobileMenuOpen(false)}>Sign Up</Link>
            </>
          )}
        </div>
      )}
      
      {/* Spinning loading keyframe style injected locally for spin animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1.5s linear infinite;
        }
      `}</style>
    </header>
  );
};


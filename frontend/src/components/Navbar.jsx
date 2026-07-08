import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { Terminal, LogOut, RefreshCw, BarChart2, BookOpen } from "lucide-react";

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);

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
        <Link to="/" className="nav-logo">
          <Terminal className="nav-logo-icon" size={24} />
          <span>CF<span style={{ color: "var(--color-primary)" }}>CodeSpace</span></span>
        </Link>

        {user ? (
          <nav className="nav-links">
            <NavLink to="/" end className={({ isActive }) => `nav-link flex-center ${isActive ? 'active' : ''}`} style={{ gap: '0.4rem' }}>
              <BarChart2 size={16} /> Dashboard
            </NavLink>
            <NavLink to="/contests" className={({ isActive }) => `nav-link flex-center ${isActive ? 'active' : ''}`} style={{ gap: '0.4rem' }}>
              <BookOpen size={16} /> Contests
            </NavLink>
            
            <button 
              onClick={handleSync} 
              disabled={syncing}
              className="btn btn-secondary flex-center"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", gap: "0.4rem" }}
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync CF"}
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

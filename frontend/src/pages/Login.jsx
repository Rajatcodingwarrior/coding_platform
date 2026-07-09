import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Terminal, Lock, User, AlertCircle } from "lucide-react";

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-center auth-page-container" style={{ minHeight: "calc(100vh - 55px)", minHeight: "calc(100dvh - 55px)" }}>
      <div className="glass-card animate-pop auth-card">
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div className="flex-center" style={{ 
            width: "50px", 
            height: "50px", 
            backgroundColor: "rgba(255, 161, 22, 0.1)", 
            color: "var(--color-primary)",
            borderRadius: "50%",
            margin: "0 auto 1rem auto"
          }}>
            <Terminal size={24} />
          </div>
          <h2>Welcome Back</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "0.5rem" }}>
            Log in to access your coding dashboard
          </p>
        </div>

        {error && (
          <div className="flex-center" style={{ 
            backgroundColor: "var(--color-error-bg)", 
            color: "#f87171",
            padding: "0.75rem",
            borderRadius: "var(--radius-sm)",
            marginBottom: "1.5rem",
            fontSize: "0.85rem",
            gap: "0.5rem",
            justifyContent: "flex-start"
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Username or Email
            </label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                <User size={16} />
              </span>
              <input 
                type="text" 
                placeholder="Enter username" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required 
                style={{ paddingLeft: "2.75rem" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                <Lock size={16} />
              </span>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                style={{ paddingLeft: "2.75rem" }}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-primary" 
            style={{ width: "100%", padding: "0.75rem", marginTop: "0.5rem" }}
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Don't have an account?{" "}
          <Link to="/signup" style={{ color: "var(--color-primary)", textDecoration: "none", fontWeight: "500" }}>
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
};

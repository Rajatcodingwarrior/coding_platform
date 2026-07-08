import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Terminal, Lock, User, Mail, AlertCircle } from "lucide-react";

export const Signup = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await signup(username, email, password);
      navigate("/");
    } catch (err) {
      setError(err.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-center" style={{ minHeight: "calc(100vh - 55px)", padding: "2rem" }}>
      <div className="glass-card animate-pop" style={{ width: "100%", maxWidth: "440px", padding: "2.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
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
          <h2>Create Account</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "0.5rem" }}>
            Get started on CFCodeSpace
          </p>
        </div>

        {error && (
          <div className="flex-center" style={{ 
            backgroundColor: "var(--color-error-bg)", 
            color: "#f87171",
            padding: "0.75rem",
            borderRadius: "var(--radius-sm)",
            marginBottom: "1.25rem",
            fontSize: "0.85rem",
            gap: "0.5rem",
            justifyContent: "flex-start"
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Username
            </label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                <User size={16} />
              </span>
              <input 
                type="text" 
                placeholder="Username (min 3 chars)" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required 
                style={{ paddingLeft: "2.75rem" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Email Address
            </label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                <Mail size={16} />
              </span>
              <input 
                type="email" 
                placeholder="you@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                style={{ paddingLeft: "2.75rem" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                <Lock size={16} />
              </span>
              <input 
                type="password" 
                placeholder="Min 6 characters" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                style={{ paddingLeft: "2.75rem" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Confirm Password
            </label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                <Lock size={16} />
              </span>
              <input 
                type="password" 
                placeholder="Confirm password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "var(--color-primary)", textDecoration: "none", fontWeight: "500" }}>
            Log In
          </Link>
        </div>
      </div>
    </div>
  );
};

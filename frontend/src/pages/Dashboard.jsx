import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { 
  Award, CheckCircle2, Star, Shuffle, BookOpen, Clock, 
  ArrowRight, Heart, RefreshCw, BarChart 
} from "lucide-react";

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await api.dashboard.stats();
      setStats(data);
    } catch (e) {
      console.error("Failed to load dashboard statistics:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleChooseForMe = async () => {
    setChoosing(true);
    try {
      const res = await api.dashboard.chooseForMe();
      if (res && res.question_id) {
        navigate(`/problem/${res.question_id}`);
      }
    } catch (e) {
      alert("Error picking random question: " + e.message);
    } finally {
      setChoosing(false);
    }
  };

  const handleRemoveFavorite = async (e, qId) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.dashboard.toggleFavorite(qId, false);
      // Refresh statistics
      fetchStats();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: "calc(100vh - 55px)" }}>
        <RefreshCw size={36} className="animate-spin" style={{ color: "var(--color-primary)" }} />
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "2.5rem 1rem", minHeight: "calc(100vh - 55px)" }}>
      {/* Welcome banner */}
      <div className="glass-card animate-fade" style={{ 
        padding: "2rem", 
        marginBottom: "2rem", 
        background: "linear-gradient(135deg, rgba(255, 161, 22, 0.08) 0%, rgba(13, 110, 253, 0) 100%)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1.5rem"
      }}>
        <div>
          <h2 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
            Welcome back, <span style={{ color: "var(--color-primary)" }}>{user.username}</span>!
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            Track your progress, solve Codeforces problems, and test your C++ solutions.
          </p>
        </div>

        <button 
          onClick={handleChooseForMe}
          disabled={choosing || !stats || stats.total_questions === 0}
          className="btn btn-primary flex-center"
          style={{ gap: "0.5rem", fontSize: "0.95rem", padding: "0.75rem 1.5rem" }}
        >
          <Shuffle size={18} />
          {choosing ? "Choosing..." : "Choose for me"}
        </button>
      </div>

      <div className="dashboard-grid">
        {/* Left Column: Stats & Completion */}
        <div className="stats-sidebar">
          <h3 style={{ fontSize: "1.1rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
            My Statistics
          </h3>

          <div className="glass-card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
              <div className="flex-center" style={{ 
                width: "45px", 
                height: "45px", 
                backgroundColor: "var(--color-success-bg)", 
                color: "var(--color-success)", 
                borderRadius: "10px" 
              }}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: "1.5rem", fontWeight: "700" }}>
                  {stats.solved_questions} <span style={{ fontSize: "1rem", color: "var(--text-muted)", fontWeight: "400" }}>/ {stats.total_questions}</span>
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Solved Problems</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Completion Rate</span>
              <span style={{ fontWeight: "600" }}>{stats.completion_rate}%</span>
            </div>
            <div style={{ width: "100%", height: "8px", backgroundColor: "#333", borderRadius: "4px", overflow: "hidden", marginBottom: "1.5rem" }}>
              <div style={{ width: `${stats.completion_rate}%`, height: "100%", backgroundColor: "var(--color-success)", borderRadius: "4px" }}></div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div className="flex-center" style={{ 
                width: "45px", 
                height: "45px", 
                backgroundColor: "rgba(255, 161, 22, 0.1)", 
                color: "var(--color-primary)", 
                borderRadius: "10px" 
              }}>
                <Heart size={20} fill="var(--color-primary)" />
              </div>
              <div>
                <div style={{ fontSize: "1.25rem", fontWeight: "700" }}>{stats.favorite_count}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Favorites</div>
              </div>
            </div>
          </div>

          {/* Quick info panel */}
          <div className="glass-card" style={{ padding: "1.25rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
            <h4 style={{ color: "var(--text-main)", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <Clock size={14} /> Synced Daily
            </h4>
            <p>Codeforces API matches the latest 5 contests and synchronizes automatically at 5 AM every day.</p>
          </div>
        </div>

        {/* Right Column: Favorites list */}
        <div className="dashboard-content">
          <h3 style={{ fontSize: "1.1rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
            My Favorite Problems
          </h3>

          {stats.favorites.length === 0 ? (
            <div className="glass-card" style={{ padding: "3rem", textAlign: "center" }}>
              <Star size={36} style={{ color: "#444", marginBottom: "1rem" }} />
              <h4 style={{ marginBottom: "0.5rem" }}>No Favorites Yet</h4>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                Add problems to your favorites list by clicking the star icon in the contests list.
              </p>
              <Link to="/contests" className="btn btn-secondary flex-center" style={{ display: "inline-flex", marginTop: "1rem", gap: "0.4rem" }}>
                Browse Contests <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="glass-card" style={{ overflow: "hidden" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Problem</th>
                    <th>Rating</th>
                    <th>Status</th>
                    <th style={{ width: "60px", textAlign: "center" }}>Remove</th>
                    <th style={{ width: "40px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {stats.favorites.map((q) => (
                    <tr 
                      key={q.id}
                      onClick={() => navigate(`/problem/${q.id}`)}
                      style={{ cursor: "pointer" }}
                    >
                      <td style={{ fontWeight: "500" }}>
                        {q.contest_id}{q.index}. {q.name}
                        <div className="tag-list">
                          {q.tags.slice(0, 2).map((t, idx) => (
                            <span key={idx} className="problem-tag">{t}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className="rating-tag">{q.rating}</span>
                      </td>
                      <td>
                        <span className={`badge ${q.is_solved ? 'badge-easy' : 'badge-medium'}`}>
                          {q.is_solved ? "Solved" : "Unsolved"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button 
                          onClick={(e) => handleRemoveFavorite(e, q.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171" }}
                        >
                          <Star size={16} fill="var(--color-primary)" style={{ color: "var(--color-primary)" }} />
                        </button>
                      </td>
                      <td>
                        <ArrowRight size={14} style={{ color: "var(--text-muted)" }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

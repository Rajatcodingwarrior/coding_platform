import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { 
  Award, CheckCircle2, Star, Shuffle, BookOpen, Clock, 
  ArrowRight, Heart, RefreshCw, BarChart 
} from "lucide-react";

const ActivityHeatmap = ({ activities }) => {
  // Convert list to map for O(1) lookups
  const activityMap = React.useMemo(() => {
    const map = {};
    if (activities) {
      activities.forEach(act => {
        map[act.date] = act.count;
      });
    }
    return map;
  }, [activities]);

  // Generate date list for the last 365 days
  const days = React.useMemo(() => {
    const arr = [];
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 364);

    for (let i = 0; i < 365; i++) {
      const cur = new Date(startDate);
      cur.setDate(startDate.getDate() + i);
      const dateStr = cur.toISOString().split("T")[0];
      const count = activityMap[dateStr] || 0;
      
      let level = 0;
      if (count > 0 && count <= 1) level = 1;
      else if (count > 1 && count <= 2) level = 2;
      else if (count > 2 && count <= 4) level = 3;
      else if (count > 4) level = 4;

      arr.push({
        date: dateStr,
        count,
        level,
        dayOfWeek: cur.getDay()
      });
    }
    return arr;
  }, [activityMap]);

  const colors = [
    "#262626", // 0 solves
    "#0e4429", // Tier 1
    "#006d32", // Tier 2
    "#26a641", // Tier 3
    "#39d353"  // Tier 4
  ];

  return (
    <div className="glass-card" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
      <h3 style={{ fontSize: "1.05rem", fontWeight: "600", color: "var(--text-main)", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <BarChart size={16} style={{ color: "var(--color-primary)" }} />
        <span>Submissions Activity</span>
      </h3>
      
      <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
        {/* Day label column */}
        <div style={{ display: "grid", gridTemplateRows: "repeat(7, 10px)", gap: "3px", fontSize: "0.68rem", color: "var(--text-muted)", alignContent: "center", justifyItems: "end", paddingRight: "0.25rem", userSelect: "none" }}>
          <span>Sun</span>
          <span></span>
          <span>Tue</span>
          <span></span>
          <span>Thu</span>
          <span></span>
          <span>Sat</span>
        </div>

        {/* The Grid */}
        <div style={{
          display: "grid",
          gridAutoFlow: "column",
          gridTemplateRows: "repeat(7, 10px)",
          gridAutoColumns: "10px",
          gap: "3px"
        }}>
          {days.map((day, idx) => (
            <div
              key={idx}
              style={{
                width: 10,
                height: 10,
                backgroundColor: colors[day.level],
                borderRadius: 2,
                cursor: "pointer"
              }}
              title={`${day.date}: ${day.count} solved`}
            />
          ))}
        </div>
      </div>
      
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.4rem", fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.75rem", userSelect: "none" }}>
        <span>Less</span>
        <div style={{ width: 10, height: 10, backgroundColor: colors[0], borderRadius: 2 }} />
        <div style={{ width: 10, height: 10, backgroundColor: colors[1], borderRadius: 2 }} />
        <div style={{ width: 10, height: 10, backgroundColor: colors[2], borderRadius: 2 }} />
        <div style={{ width: 10, height: 10, backgroundColor: colors[3], borderRadius: 2 }} />
        <div style={{ width: 10, height: 10, backgroundColor: colors[4], borderRadius: 2 }} />
        <span>More</span>
      </div>
    </div>
  );
};

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
    <div className="container dashboard-container">
      {/* Welcome banner */}
      <div className="glass-card animate-fade" style={{ 
        padding: "clamp(1rem, 3vw, 2rem)", 
        marginBottom: "1.5rem", 
        background: "linear-gradient(135deg, rgba(255, 161, 22, 0.08) 0%, rgba(13, 110, 253, 0) 100%)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1rem"
      }}>
        <div>
          <h2 style={{ fontSize: "clamp(1.15rem, 4vw, 1.75rem)", marginBottom: "0.35rem" }}>
            Welcome back, <span style={{ color: "var(--color-primary)" }}>{user.username}</span>!
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "clamp(0.8rem, 2.5vw, 0.95rem)" }}>
            Track your progress, solve problems, and test your solutions.
          </p>
        </div>
        <button 
          onClick={handleChooseForMe}
          disabled={choosing || !stats || stats.total_questions === 0}
          className="btn btn-primary flex-center"
          style={{ gap: "0.5rem", fontSize: "clamp(0.8rem, 2.5vw, 0.95rem)", padding: "0.6rem 1.2rem", whiteSpace: "nowrap" }}
        >
          <Shuffle size={18} />
          {choosing ? "Choosing..." : "Choose for me"}
        </button>
      </div>
      {/* Activity Heatmap */}
      <ActivityHeatmap activities={stats.daily_activities} />

      <div className="dashboard-grid">
        {/* Left Column: Stats & Completion */}
        <div className="stats-sidebar">
          <h3 style={{ fontSize: "1.1rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
            My Statistics
          </h3>

          <div className="glass-card" style={{ padding: "1.5rem" }}>
            {/* Circular Progress & Key stats */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.75rem", gap: "1.5rem" }}>
              <div style={{ position: "relative", width: "90px", height: "90px", display: "flex", justifyContent: "center", alignItems: "center" }}>
                {/* SVG Progress Ring */}
                <svg width="90" height="90" viewBox="0 0 90 90" style={{ transform: "rotate(-90deg)", position: "absolute" }}>
                  <circle cx="45" cy="45" r="36" stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="transparent" />
                  <circle 
                    cx="45" 
                    cy="45" 
                    r="36" 
                    stroke="var(--color-success)" 
                    strokeWidth="6" 
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 36} 
                    strokeDashoffset={2 * Math.PI * 36 - (stats.completion_rate / 100) * (2 * Math.PI * 36)} 
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 0.8s ease" }} 
                  />
                </svg>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--text-main)" }}>{stats.completion_rate}%</div>
                  <div style={{ fontSize: "0.58rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Solved</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div>
                  <div style={{ fontSize: "1.35rem", fontWeight: "700", color: "var(--text-bright)" }}>
                    {stats.solved_questions}
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: "400", marginLeft: "0.2rem" }}>/ {stats.total_questions}</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Solved Problems</div>
                </div>
                <div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--text-bright)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <Heart size={14} fill="var(--color-primary)" style={{ color: "var(--color-primary)" }} />
                    {stats.favorite_count}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Favorites</div>
                </div>
              </div>
            </div>

            {/* Platform breakdowns bar lists */}
            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "1.25rem" }}>
              <h4 style={{ fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "1rem" }}>
                Platform Breakdown
              </h4>

              {/* Codeforces */}
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.3rem" }}>
                  <span style={{ color: "#FF4C4C", fontWeight: "600" }}>Codeforces</span>
                  <span style={{ fontWeight: "600" }}>{stats.platform_breakdown?.codeforces || 0}</span>
                </div>
                <div style={{ width: "100%", height: "4px", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ width: `${stats.solved_questions > 0 ? ((stats.platform_breakdown?.codeforces || 0) / stats.solved_questions) * 100 : 0}%`, height: "100%", backgroundColor: "#FF4C4C", borderRadius: "2px" }} />
                </div>
              </div>

              {/* LeetCode */}
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.3rem" }}>
                  <span style={{ color: "#FFA116", fontWeight: "600" }}>LeetCode</span>
                  <span style={{ fontWeight: "600" }}>{stats.platform_breakdown?.leetcode || 0}</span>
                </div>
                <div style={{ width: "100%", height: "4px", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ width: `${stats.solved_questions > 0 ? ((stats.platform_breakdown?.leetcode || 0) / stats.solved_questions) * 100 : 0}%`, height: "100%", backgroundColor: "#FFA116", borderRadius: "2px" }} />
                </div>
              </div>

              {/* CodeChef */}
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.3rem" }}>
                  <span style={{ color: "#B97D4B", fontWeight: "600" }}>CodeChef</span>
                  <span style={{ fontWeight: "600" }}>{stats.platform_breakdown?.codechef || 0}</span>
                </div>
                <div style={{ width: "100%", height: "4px", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ width: `${stats.solved_questions > 0 ? ((stats.platform_breakdown?.codechef || 0) / stats.solved_questions) * 100 : 0}%`, height: "100%", backgroundColor: "#B97D4B", borderRadius: "2px" }} />
                </div>
              </div>

              {/* AtCoder */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.3rem" }}>
                  <span style={{ color: "#5B8BFF", fontWeight: "600" }}>AtCoder</span>
                  <span style={{ fontWeight: "600" }}>{stats.platform_breakdown?.atcoder || 0}</span>
                </div>
                <div style={{ width: "100%", height: "4px", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ width: `${stats.solved_questions > 0 ? ((stats.platform_breakdown?.atcoder || 0) / stats.solved_questions) * 100 : 0}%`, height: "100%", backgroundColor: "#5B8BFF", borderRadius: "2px" }} />
                </div>
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
              <div className="table-container" style={{ margin: 0 }}>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

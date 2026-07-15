import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { Calendar, Clock, RefreshCw, Filter, ExternalLink, ShieldAlert } from "lucide-react";

// Platform colors & label mapping
const platformConfig = {
  codeforces: { label: "Codeforces", cls: "platform-codeforces", color: "#FF4C4C", url: "https://codeforces.com" },
  leetcode:   { label: "LeetCode", cls: "platform-leetcode", color: "#FFA116", url: "https://leetcode.com" },
  codechef:   { label: "CodeChef", cls: "platform-codechef", color: "#B97D4B", url: "https://codechef.com" },
  atcoder:    { label: "AtCoder", cls: "platform-atcoder", color: "#5B8BFF", url: "https://atcoder.jp" }
};

export const UpcomingContests = () => {
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // Fetch upcoming contests
  const fetchUpcoming = async () => {
    setLoading(true);
    try {
      const data = await api.contests.upcoming();
      setContests(data);
    } catch (e) {
      console.error("Failed to load upcoming contests:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpcoming();
    // Update current time every second for precise countdowns
    const timer = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getGoogleCalendarLink = (contest) => {
    const title = encodeURIComponent(contest.name);
    const startDate = new Date(contest.start_time_seconds * 1000)
      .toISOString()
      .replace(/-|:|\.\d\d\d/g, "");
    const endDate = new Date((contest.start_time_seconds + (contest.duration_seconds || 7200)) * 1000)
      .toISOString()
      .replace(/-|:|\.\d\d\d/g, "");
    const details = encodeURIComponent(`Upcoming Contest on ${contest.platform.toUpperCase()}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}`;
  };

  const downloadICS = (contest) => {
    const title = contest.name;
    const startDate = new Date(contest.start_time_seconds * 1000)
      .toISOString()
      .replace(/-|:|\.\d\d\d/g, "");
    const endDate = new Date((contest.start_time_seconds + (contest.duration_seconds || 7200)) * 1000)
      .toISOString()
      .replace(/-|:|\.\d\d\d/g, "");
    
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Coding Portal//Upcoming Contests//EN",
      "BEGIN:VEVENT",
      `UID:upcoming_${contest.id}@coding_portal`,
      `DTSTAMP:${new Date().toISOString().replace(/-|:|\.\d\d\d/g, "")}`,
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:Platform: ${contest.platform.toUpperCase()}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute("download", `upcoming_${contest.id}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCountdown = (startSeconds) => {
    const diff = startSeconds - now;
    if (diff <= 0) return "Started!";
    const d = Math.floor(diff / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0 || d > 0) parts.push(`${h}h`);
    parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(" ");
  };

  const formatDate = (startSeconds) => {
    const date = new Date(startSeconds * 1000);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getContestLink = (c) => {
    const platform = c.platform;
    const originalId = c.id.includes("_") ? c.id.split("_").slice(1).join("_") : c.id;
    
    if (platform === "codeforces") {
      return `https://codeforces.com/contests/${originalId}`;
    }
    if (platform === "leetcode") {
      return `https://leetcode.com/contest/${originalId}`;
    }
    if (platform === "codechef") {
      return `https://www.codechef.com/${originalId}`;
    }
    if (platform === "atcoder") {
      return `https://atcoder.jp/contests/${originalId}`;
    }
    return "#";
  };

  const filteredContests = contests.filter(c => 
    filterPlatform === "all" || c.platform === filterPlatform
  );

  return (
    <div className="container contests-container">
      {/* Header section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "clamp(1rem, 3vw, 2rem)", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "clamp(1.15rem, 4vw, 1.75rem)", fontWeight: "700" }}>Upcoming Contest Calendar</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "clamp(0.8rem, 2.5vw, 0.92rem)", marginTop: "0.25rem" }}>
            Track and register for upcoming competitions from major platforms.
          </p>
        </div>
        <button
          onClick={fetchUpcoming}
          className="btn btn-secondary flex-center"
          style={{ gap: "0.4rem", padding: "0.55rem 1rem", fontSize: "0.85rem" }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Platform filters */}
      <div className="glass-card" style={{ padding: "0.65rem 0.75rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", overflowX: "auto" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.35rem", marginRight: "0.5rem" }}>
          <Filter size={13} /> Filter:
        </span>
        <button
          onClick={() => setFilterPlatform("all")}
          className={`btn ${filterPlatform === "all" ? "btn-primary" : "btn-secondary"}`}
          style={{ padding: "4px 12px", fontSize: "0.78rem" }}
        >
          All
        </button>
        {Object.entries(platformConfig).map(([slug, cfg]) => (
          <button
            key={slug}
            onClick={() => setFilterPlatform(slug)}
            className={`btn ${filterPlatform === slug ? "btn-primary" : "btn-secondary"}`}
            style={{ 
              padding: "4px 12px", 
              fontSize: "0.78rem",
              border: filterPlatform === slug ? "none" : `1px solid ${cfg.color}33`,
              color: filterPlatform === slug ? "#fff" : "var(--text-main)"
            }}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex-center" style={{ padding: "6rem 0" }}>
          <RefreshCw size={36} className="animate-spin" style={{ color: "var(--color-primary)" }} />
        </div>
      ) : filteredContests.length === 0 ? (
        <div className="glass-card" style={{ padding: "4rem", textAlign: "center" }}>
          <Calendar size={40} style={{ color: "var(--text-muted)", marginBottom: "1rem" }} />
          <h3>No Upcoming Contests</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "0.4rem" }}>
            No scheduled contests found for the selected platform filters. Click Refresh to check again.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))", gap: "1rem" }}>
          {filteredContests.map((c) => {
            const cfg = platformConfig[c.platform] || { color: "#ffa116", label: c.platform.toUpperCase(), url: "#" };
            return (
              <div 
                key={c.id} 
                className="glass-card animate-fade" 
                style={{ 
                  padding: "clamp(1rem, 3vw, 1.5rem)", 
                  borderLeft: `4px solid ${cfg.color}`,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: "180px"
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                    <span 
                      style={{ 
                        fontSize: "0.7rem", 
                        fontWeight: "700", 
                        padding: "2px 8px", 
                        borderRadius: "20px", 
                        backgroundColor: `${cfg.color}15`, 
                        color: cfg.color,
                        textTransform: "uppercase"
                      }}
                    >
                      {cfg.label}
                    </span>
                    <a 
                      href={getContestLink(c)} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ color: "var(--text-muted)", display: "flex", alignItems: "center" }}
                      title="Register / View Contest"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                  
                  <h3 style={{ fontSize: "1.05rem", fontWeight: "700", lineHeight: "1.4", color: "var(--text-main)", marginBottom: "0.75rem" }}>
                    <a 
                      href={getContestLink(c)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "inherit", textDecoration: "none" }}
                      className="upcoming-title-link"
                    >
                      {c.name}
                    </a>
                  </h3>
                </div>

                <div>
                  <div style={{ display: "flex", gap: "1rem", color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: "1.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <Calendar size={13} style={{ color: "var(--color-primary)" }} />
                      <span>{formatDate(c.start_time_seconds)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <Clock size={13} style={{ color: "var(--color-info)" }} />
                      <span>{Math.round(c.duration_seconds / 3600)} hrs</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Starts In</span>
                      <span style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--color-success)" }}>
                        {formatCountdown(c.start_time_seconds)}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <a 
                        href={getGoogleCalendarLink(c)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                        style={{ padding: "4px 8px", fontSize: "0.72rem", border: "1px solid var(--border-color)" }}
                        title="Add to Google Calendar"
                      >
                        Google Cal
                      </a>
                      <button 
                        onClick={() => downloadICS(c)}
                        className="btn btn-secondary"
                        style={{ padding: "4px 8px", fontSize: "0.72rem", border: "1px solid var(--border-color)" }}
                        title="Download ICS reminder"
                      >
                        ICS File
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

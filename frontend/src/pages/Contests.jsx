import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import { BookOpen, CheckCircle, Circle, Star, Calendar, Clock, ChevronRight, ChevronLeft, RefreshCw, Zap } from "lucide-react";

const PLATFORM_CFG = {
  all:         { label: "All",        pill: "active",    dot: "#9ba3af" },
  codeforces:  { label: "Codeforces", pill: "active-cf", dot: "var(--cf-color)" },
  leetcode:    { label: "LeetCode",   pill: "active-lc", dot: "var(--lc-color)" },
  codechef:    { label: "CodeChef",   pill: "active-cc", dot: "var(--cc-color)" },
  atcoder:     { label: "AtCoder",    pill: "active-ac", dot: "var(--ac-color)" },
};

const PlatformBadge = ({ platform }) => {
  const cfg = {
    codeforces: { label: "CF", cls: "platform-codeforces" },
    leetcode:   { label: "LC", cls: "platform-leetcode" },
    codechef:   { label: "CC", cls: "platform-codechef" },
    atcoder:    { label: "AC", cls: "platform-atcoder" },
  };
  const c = cfg[platform] || cfg.codeforces;
  return <span className={`platform-badge ${c.cls}`}>{c.label}</span>;
};

const getDiffClass  = (r) => !r || r < 1200 ? "badge-easy" : r < 1600 ? "badge-medium" : "badge-hard";
const getDiffLabel  = (r) => !r || r < 1200 ? "Easy"       : r < 1600 ? "Medium"       : "Hard";

const getStarDisplay = (stars) => {
  if (!stars || stars <= 0) return '★';
  const full = Math.floor(stars);
  const half = stars % 1 >= 0.5 ? 1 : 0;
  return '★'.repeat(full) + (half ? '½' : '');
};

const getRatingColor = (r) => {
  if (!r || r < 1000) return '#808080';
  if (r < 1200) return '#00C853';
  if (r < 1400) return '#FFD600';
  if (r < 1600) return '#FF9100';
  if (r < 2000) return '#FF5252';
  if (r < 2500) return '#E040FB';
  return '#FF1744';
};

const formatDate = (secs) =>
  new Date(secs * 1000).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });

export const Contests = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPlatform = searchParams.get("platform") || "all";
  const urlContestId = searchParams.get("contest") || "";

  const [contests, setContests]               = useState([]);
  const [selectedContest, setSelectedContest] = useState(null);
  const [questions, setQuestions]             = useState([]);
  const [loadingContests,  setLoadingContests]  = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [platformFilter, setPlatformFilter]   = useState(urlPlatform);
  const [viewMode, setViewMode]               = useState(urlContestId ? "problems" : "list"); // "list" or "problems" on mobile
  const navigate = useNavigate();

  const getGoogleCalendarLink = (contest) => {
    const title = encodeURIComponent(contest.name);
    const startDate = new Date(contest.start_time_seconds * 1000)
      .toISOString()
      .replace(/-|:|\.\d\d\d/g, ""); // YYYYMMDDTHHmmSSZ
    const endDate = new Date((contest.start_time_seconds + (contest.duration_seconds || 7200)) * 1000)
      .toISOString()
      .replace(/-|:|\.\d\d\d/g, "");
    const details = encodeURIComponent(`Platform: ${contest.platform || 'codeforces'}`);
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
      "PRODID:-//Coding Portal//Contest Sync//EN",
      "BEGIN:VEVENT",
      `UID:contest_${contest.id || 'id'}@coding_portal`,
      `DTSTAMP:${new Date().toISOString().replace(/-|:|\.\d\d\d/g, "")}`,
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:Platform: ${contest.platform || 'codeforces'}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute("download", `${contest.id || 'contest'}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const loadAndInit = async () => {
      setLoadingContests(true);
      try {
        const data = await api.contests.list();
        setContests(data);
        
        if (urlContestId) {
          const matched = data.find(c => c.id === urlContestId);
          if (matched) {
            setSelectedContest(matched);
            setLoadingQuestions(true);
            setViewMode("problems");
            try {
              const qData = await api.contests.getQuestions(matched.id);
              setQuestions(qData);
            } catch (e) {
              console.error("Failed to fetch questions for auto-selected contest:", e);
            } finally {
              setLoadingQuestions(false);
            }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingContests(false);
      }
    };
    loadAndInit();
  }, [urlContestId]);

  const handleSelectContest = async (contest, shouldSwitchView = true) => {
    setSelectedContest(contest);
    setSearchParams(prev => {
      prev.set("contest", contest.id);
      return prev;
    });
    setLoadingQuestions(true);
    if (shouldSwitchView) {
      setViewMode("problems");
    }
    try {
      const qData = await api.contests.getQuestions(contest.id);
      setQuestions(qData);
    } catch (e) { console.error(e); }
    finally { setLoadingQuestions(false); }
  };

  const handleToggleFavorite = async (e, qId, cur) => {
    e.stopPropagation();
    try {
      await api.dashboard.toggleFavorite(qId, !cur);
      setQuestions(qs => qs.map(q => q.id === qId ? { ...q, is_favorite: !cur } : q));
    } catch (err) { console.error(err); }
  };

  const handlePlatformFilterChange = (key) => {
    setPlatformFilter(key);
    setSearchParams(prev => {
      prev.set("platform", key);
      prev.delete("contest");
      return prev;
    });
    setSelectedContest(null);
    setViewMode("list");
  };

  const filteredContests = platformFilter === "all"
    ? contests
    : contests.filter(c => (c.platform || "codeforces") === platformFilter);

  const platformCounts = contests.reduce((acc, c) => {
    const p = c.platform || "codeforces";
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ minHeight: "calc(100vh - 55px)", background: "var(--bg-deep)" }}>
      <div className="container contests-container">

        {/* ── Page header ── */}
        <div style={{ marginBottom: "1.75rem" }}>
          <h2 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "0.4rem" }}>
            Contest Problems
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.92rem" }}>
            Latest problems from Codeforces, LeetCode, CodeChef &amp; AtCoder — all in one place.
          </p>
        </div>

        {/* ── Platform filter pills ── */}
        <div className="filter-pills">
          {Object.entries(PLATFORM_CFG).map(([key, cfg]) => {
            const count = key === "all" ? contests.length : (platformCounts[key] || 0);
            const isActive = platformFilter === key;
            return (
              <button
                key={key}
                className={`filter-pill ${isActive ? cfg.pill : ""}`}
                onClick={() => handlePlatformFilterChange(key)}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
              >
                {key !== "all" && (
                  <span style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: isActive ? "currentColor" : cfg.dot,
                    display: "inline-block", flexShrink: 0
                  }} />
                )}
                {cfg.label}
                <span style={{
                  background: isActive ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.07)",
                  borderRadius: 10, padding: "0 5px", fontSize: "0.68rem", fontWeight: 700
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Main two-column layout ── */}
        <div className="contests-grid">

          {/* Left: Contest list */}
          <div className={`contests-list-pane ${viewMode === "problems" ? "mobile-hidden" : ""}`}>
            <div style={{
              fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "0.75rem"
            }}>
              {filteredContests.length} Contest{filteredContests.length !== 1 ? "s" : ""}
            </div>

            {loadingContests ? (
              <div className="flex-center" style={{ padding: "4rem 0" }}>
                <RefreshCw size={22} className="animate-spin" style={{ color: "var(--color-primary)" }} />
              </div>
            ) : filteredContests.length === 0 ? (
              <div className="glass-card" style={{ padding: "2rem", textAlign: "center" }}>
                <Zap size={28} style={{ color: "var(--text-muted)", marginBottom: "0.5rem" }} />
                <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
                  No contests synced for this platform yet.
                </p>
              </div>
            ) : (
              <div className="contests-list-wrapper">
                {filteredContests.map((c) => {
                  const isSelected = selectedContest?.id === c.id;
                  const platform   = c.platform || "codeforces";
                  const dotColor   = PLATFORM_CFG[platform]?.dot || "#9ba3af";
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelectContest(c)}
                      className="glass-card"
                      style={{
                        padding: "1rem 1.1rem", cursor: "pointer",
                        borderColor: isSelected ? dotColor : "var(--border-color)",
                        backgroundColor: isSelected ? `rgba(${platform === "codeforces" ? "255,76,76" : platform === "leetcode" ? "255,161,22" : platform === "codechef" ? "185,125,75" : "91,139,255"}, 0.05)` : "var(--bg-main)",
                        transition: "all 0.18s ease"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.45rem" }}>
                        <PlatformBadge platform={platform} />
                        <h4 style={{
                          color: isSelected ? "var(--text-main)" : "var(--text-main)",
                          fontSize: "0.87rem", fontWeight: 600, lineHeight: 1.3,
                          overflow: "hidden", display: "-webkit-box",
                          WebkitLineClamp: 2, WebkitBoxOrient: "vertical"
                        }}>
                          {c.name}
                        </h4>
                      </div>
                      <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <Calendar size={10} /> {formatDate(c.start_time_seconds)}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <Clock size={10} /> {Math.round(c.duration_seconds / 3600)}h
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Problems table */}
          {selectedContest && (
            <div className={`contests-problems-pane ${viewMode === "list" ? "mobile-hidden" : ""}`}>
              <button
                className="back-to-contests-btn"
                onClick={() => {
                  setViewMode("list");
                  setSearchParams(prev => {
                    prev.delete("contest");
                    return prev;
                  });
                  setSelectedContest(null);
                }}
              >
                <ChevronLeft size={14} /> Back to Contests
              </button>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.2rem" }}>
                    <PlatformBadge platform={selectedContest.platform || "codeforces"} />
                    <h3 style={{ fontSize: "1.15rem", fontWeight: "700" }}>{selectedContest.name}</h3>
                  </div>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                    {formatDate(selectedContest.start_time_seconds)} · {Math.round(selectedContest.duration_seconds / 3600)}h
                  </p>
                </div>

                {/* Calendar Sync Buttons */}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <a
                    href={getGoogleCalendarLink(selectedContest)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ 
                      padding: "6px 12px", 
                      fontSize: "0.75rem", 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "0.4rem",
                      borderRadius: "6px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-main)",
                      textDecoration: "none",
                      cursor: "pointer"
                    }}
                    title="Add to Google Calendar"
                  >
                    <Calendar size={13} style={{ color: "var(--color-primary)" }} />
                    <span>Google Calendar</span>
                  </a>
                  <button
                    onClick={() => downloadICS(selectedContest)}
                    className="btn btn-secondary"
                    style={{ 
                      padding: "6px 12px", 
                      fontSize: "0.75rem", 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "0.4rem",
                      borderRadius: "6px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-main)",
                      cursor: "pointer"
                    }}
                    title="Download ICS File"
                  >
                    <Clock size={13} style={{ color: "var(--color-info)" }} />
                    <span>Download ICS</span>
                  </button>
                </div>
              </div>

              {loadingQuestions ? (
                <div className="flex-center" style={{ padding: "6rem 0" }}>
                  <RefreshCw size={28} className="animate-spin" style={{ color: "var(--color-primary)" }} />
                </div>
              ) : questions.length === 0 ? (
                <div className="glass-card" style={{ padding: "3rem", textAlign: "center" }}>
                  <BookOpen size={32} style={{ color: "var(--text-muted)", marginBottom: "0.75rem" }} />
                  <p style={{ color: "var(--text-muted)" }}>No problems synced yet. Refresh shortly.</p>
                </div>
              ) : (
                <div className="glass-card" style={{ overflow: "hidden" }}>
                  <div className="table-container" style={{ margin: 0 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}></th>
                          <th>Problem</th>
                          <th style={{ width: 120 }}>Rating &amp; Stars</th>
                          <th style={{ width: 100 }}>Difficulty</th>
                          <th style={{ width: 50, textAlign: "center" }}>★</th>
                          <th style={{ width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {questions.map((q) => (
                          <tr
                            key={q.id}
                            onClick={() => navigate(`/problem/${q.id}`)}
                            style={{ cursor: "pointer" }}
                          >
                            <td>
                              {q.is_solved
                                ? <CheckCircle size={16} style={{ color: "var(--color-success)" }} />
                                : <Circle     size={16} style={{ color: "var(--border-color)" }} />}
                            </td>
                            <td>
                              <div style={{ fontWeight: 500, fontSize: "0.88rem" }}>
                                <span style={{ color: "var(--text-muted)", marginRight: "0.4rem" }}>{q.index}.</span>
                                {q.name.replace(/^[A-Z]\.\s*/, "")}
                              </div>
                              <div className="tag-list">
                                {q.tags.slice(0, 4).map((t, i) => (
                                  <span key={i} className="problem-tag">{t}</span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span className="rating-tag" style={{ background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "600", color: getRatingColor(q.rating) }}>
                                  {q.rating}
                                </span>
                                {q.stars > 0 && (
                                  <span style={{ color: getRatingColor(q.rating), fontSize: '0.75rem', letterSpacing: '-0.5px', fontWeight: "bold" }}>
                                    {getStarDisplay(q.stars)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${getDiffClass(q.rating)}`}>
                                {getDiffLabel(q.rating)}
                              </span>
                            </td>
                            <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => handleToggleFavorite(e, q.id, q.is_favorite)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: q.is_favorite ? "var(--color-primary)" : "var(--text-muted)", padding: "0.2rem" }}
                              >
                                <Star size={15} fill={q.is_favorite ? "var(--color-primary)" : "none"} />
                              </button>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <ChevronRight size={15} style={{ color: "var(--text-muted)" }} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

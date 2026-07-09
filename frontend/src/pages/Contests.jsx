import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { BookOpen, CheckCircle, Circle, Star, Calendar, Clock, ChevronRight, RefreshCw, Zap } from "lucide-react";

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

const formatDate = (secs) =>
  new Date(secs * 1000).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });

export const Contests = () => {
  const [contests, setContests]               = useState([]);
  const [selectedContest, setSelectedContest] = useState(null);
  const [questions, setQuestions]             = useState([]);
  const [loadingContests,  setLoadingContests]  = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [platformFilter, setPlatformFilter]   = useState("all");
  const navigate = useNavigate();

  useEffect(() => { fetchContests(); }, []);

  const fetchContests = async () => {
    setLoadingContests(true);
    try {
      const data = await api.contests.list();
      setContests(data);
      if (data.length > 0) handleSelectContest(data[0]);
    } catch (e) { console.error(e); }
    finally { setLoadingContests(false); }
  };

  const handleSelectContest = async (contest) => {
    setSelectedContest(contest);
    setLoadingQuestions(true);
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
                onClick={() => setPlatformFilter(key)}
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
          <div>
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
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
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
          <div>
            {selectedContest ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.2rem" }}>
                      <PlatformBadge platform={selectedContest.platform || "codeforces"} />
                      <h3 style={{ fontSize: "1.1rem" }}>{selectedContest.name}</h3>
                    </div>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                      {formatDate(selectedContest.start_time_seconds)} · {Math.round(selectedContest.duration_seconds / 3600)}h
                    </p>
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
                            <th style={{ width: 110 }}>Difficulty</th>
                            <th style={{ width: 90 }}>Rating</th>
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
                                <span className={`badge ${getDiffClass(q.rating)}`}>
                                  {getDiffLabel(q.rating)}
                                </span>
                              </td>
                              <td>
                                <span className="rating-tag">{q.rating}</span>
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  onClick={(e) => handleToggleFavorite(e, q.id, q.is_favorite)}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: q.is_favorite ? "var(--color-primary)" : "var(--text-muted)", padding: "0.2rem" }}
                                >
                                  <Star size={15} fill={q.is_favorite ? "var(--color-primary)" : "none"} />
                                </button>
                              </td>
                              <td>
                                <ChevronRight size={15} style={{ color: "var(--text-muted)" }} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-center glass-card" style={{ padding: "5rem", flexDirection: "column", gap: "1rem", color: "var(--text-muted)" }}>
                <BookOpen size={36} style={{ opacity: 0.3 }} />
                <p>Select a contest from the left to view its problems.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import {
  Play, Send, CheckCircle, XCircle, RefreshCw, Star,
  BookOpen, ExternalLink, Code, Terminal, Check, X,
  Timer, Pause, RotateCcw, Copy, ChevronLeft
} from "lucide-react";

// ── Platform badge helper ──────────────────────────────────────
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

// ── Stopwatch ──────────────────────────────────────────────────
const useStopwatch = () => {
  const [elapsed, setElapsed] = useState(0);   // seconds
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  const start = useCallback(() => {
    if (!running) {
      setRunning(true);
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    }
  }, [running]);

  const pause = useCallback(() => {
    if (running) {
      setRunning(false);
      clearInterval(intervalRef.current);
    }
  }, [running]);

  const reset = useCallback(() => {
    setRunning(false);
    clearInterval(intervalRef.current);
    setElapsed(0);
  }, []);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const fmt = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map(v => String(v).padStart(2, "0")).join(":");
  };

  return { elapsed, running, formatted: fmt(elapsed), start, pause, reset };
};

// ── Stopwatch Widget ───────────────────────────────────────────
const StopwatchWidget = () => {
  const { formatted, running, start, pause, reset } = useStopwatch();
  return (
    <div className="stopwatch-widget">
      <Timer size={13} style={{ color: "var(--text-muted)" }} />
      <span className={`stopwatch-display ${running ? "running" : ""}`}>{formatted}</span>
      {!running ? (
        <button className="stopwatch-btn" onClick={start} title="Start Timer">
          <Play size={12} style={{ color: "var(--color-success)" }} />
        </button>
      ) : (
        <button className="stopwatch-btn" onClick={pause} title="Pause Timer">
          <Pause size={12} style={{ color: "var(--color-warning)" }} />
        </button>
      )}
      <button className="stopwatch-btn" onClick={reset} title="Reset Timer">
        <RotateCcw size={12} />
      </button>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────
export const ProblemDetails = () => {
  const { questionId } = useParams();
  const navigate = useNavigate();

  const [question, setQuestion] = useState(null);
  const [loading, setLoading]   = useState(true);

  const [leftTab,  setLeftTab]  = useState("description");
  const [rightTab, setRightTab] = useState("editor");

  const [code, setCode]               = useState("");
  const [customInput, setCustomInput] = useState("");

  const [isRunning,    setIsRunning]    = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runResult,    setRunResult]    = useState(null);
  const [submitResult, setSubmitResult] = useState(null);

  const [isFavorite, setIsFavorite] = useState(false);
  const [isSolved,   setIsSolved]   = useState(false);
  const [copied,     setCopied]     = useState(false);

  const textareaRef = useRef(null);

  // ── MathJax typeset on description tab ──────────────────────
  useEffect(() => {
    if (question && leftTab === "description" && window.MathJax?.typesetPromise) {
      setTimeout(() => window.MathJax.typesetPromise(), 120);
    }
  }, [question, leftTab]);

  useEffect(() => { fetchQuestionDetails(); }, [questionId]);

  const fetchQuestionDetails = async () => {
    setLoading(true);
    try {
      const q = await api.questions.get(questionId);
      setQuestion(q);
      setCode(
        q.last_submission_code ||
        `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    \n    return 0;\n}\n`
      );
      setIsFavorite(q.is_favorite || false);
      setIsSolved(q.is_solved   || false);
      if (q.test_cases?.length > 0) setCustomInput(q.test_cases[0].input);
    } catch (e) {
      alert("Failed to load question: " + e.message);
      navigate("/contests");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async () => {
    try {
      const res = await api.dashboard.toggleFavorite(questionId, !isFavorite);
      setIsFavorite(res.is_favorite);
    } catch (e) { console.error(e); }
  };

  const handleToggleComplete = async () => {
    try {
      const res = await api.dashboard.toggleComplete(questionId, !isSolved);
      setIsSolved(res.is_solved);
    } catch (e) { console.error(e); }
  };

  const handleRunCode = async () => {
    setIsRunning(true); setRightTab("console");
    setRunResult(null); setSubmitResult(null);
    try {
      const res = await api.compiler.run(code, customInput);
      setRunResult(res);
    } catch (e) {
      setRunResult({ success: false, error: e.message || "Failed to run" });
    } finally { setIsRunning(false); }
  };

  const handleSubmitCode = async () => {
    setIsSubmitting(true); setRightTab("console");
    setRunResult(null); setSubmitResult(null);
    try {
      const res = await api.compiler.submit(questionId, code);
      setSubmitResult(res);
      if (res.success) setIsSolved(true);
    } catch (e) {
      alert("Submission error: " + e.message);
    } finally { setIsSubmitting(false); }
  };

  // Tab key indent
  const handleKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: end, value } = e.target;
      const next = value.slice(0, s) + "    " + value.slice(end);
      setCode(next);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = s + 4;
        }
      }, 0);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const lineNumbers = code.split("\n").map((_, i) => i + 1);

  const platformColor = {
    codeforces: "var(--cf-color)",
    leetcode:   "var(--lc-color)",
    codechef:   "var(--cc-color)",
    atcoder:    "var(--ac-color)",
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ height: "calc(100vh - 55px)", flexDirection: "column", gap: "1rem" }}>
        <RefreshCw size={32} className="animate-spin" style={{ color: "var(--color-primary)" }} />
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Loading problem…</p>
      </div>
    );
  }

  const accentColor = platformColor[question.platform] || "var(--color-primary)";

  return (
    <div className="ide-wrapper animate-fade">

      {/* ═══════════════════ LEFT PANE ═══════════════════ */}
      <div className="pane-left">
        {/* Tabs */}
        <div className="pane-header" style={{ gap: "1rem" }}>
          <button
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", marginRight: "0.25rem" }}
            onClick={() => navigate("/contests")}
            title="Back to contests"
          >
            <ChevronLeft size={16} />
          </button>
          <div onClick={() => setLeftTab("description")} className={`pane-tab ${leftTab === "description" ? "active" : ""}`}>
            <BookOpen size={13} /> Description
          </div>
          <div onClick={() => setLeftTab("solution")} className={`pane-tab ${leftTab === "solution" ? "active" : ""}`}>
            <Code size={13} /> Solution
          </div>
          {/* Stopwatch on the far right of left pane header */}
          <StopwatchWidget />
        </div>

        <div className="pane-content">
          {leftTab === "description" ? (
            <div>
              {/* ── Problem title & meta ── */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div style={{ flex: 1, marginRight: "1rem" }}>
                  <h2 style={{ fontSize: "1.25rem", lineHeight: "1.4", marginBottom: "0.5rem" }}>
                    {question.name}
                  </h2>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <PlatformBadge platform={question.platform} />
                    <span className={`badge ${question.rating < 1200 ? "badge-easy" : question.rating < 1600 ? "badge-medium" : "badge-hard"}`}>
                      {question.rating < 1200 ? "Easy" : question.rating < 1600 ? "Medium" : "Hard"}
                    </span>
                    <span className="rating-tag" style={{ borderColor: `${accentColor}55`, color: accentColor }}>
                      ★ {question.rating}
                    </span>
                    {question.editorial_url && (
                      <a
                        href={question.editorial_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-center rating-tag"
                        style={{ textDecoration: "none", color: "var(--color-info)", border: "1px solid rgba(56,148,255,0.3)", gap: "0.25rem", fontSize: "0.72rem" }}
                      >
                        <ExternalLink size={10} /> Editorial
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleToggleFavorite}
                  style={{ background: "none", border: "none", cursor: "pointer", color: isFavorite ? "var(--color-primary)" : "var(--text-muted)", flexShrink: 0 }}
                  title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                  <Star size={18} fill={isFavorite ? "var(--color-primary)" : "none"} />
                </button>
              </div>

              {/* Tags row */}
              {question.tags?.length > 0 && (
                <div className="tag-list" style={{ marginBottom: "1.5rem" }}>
                  {question.tags.map((t, i) => <span key={i} className="problem-tag">{t}</span>)}
                </div>
              )}

              <div style={{ height: "1px", background: "var(--border-color)", marginBottom: "1.5rem" }} />

              {/* ── Problem description HTML ── */}
              {question.description_html ? (
                <div
                  className="problem-statement-wrapper"
                  dangerouslySetInnerHTML={{ __html: question.description_html }}
                />
              ) : (
                <div className="problem-statement-wrapper">
                  <p>Solve this problem from <strong>{question.contest_id}</strong>.</p>
                  <p style={{ marginTop: "0.75rem", color: "var(--text-muted)" }}>
                    Write your C++ solution in the editor. Run it on custom inputs, then submit to validate against sample test cases.
                  </p>
                </div>
              )}

              {/* ── Sample Test Cases ── */}
              {question.test_cases?.length > 0 && (
                <div style={{ marginTop: "2rem" }}>
                  <h3 style={{
                    fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.08em", color: "var(--text-muted)",
                    marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem"
                  }}>
                    <span style={{ width: 3, height: 14, background: accentColor, borderRadius: 2, display: "inline-block" }} />
                    Examples
                  </h3>
                  {question.test_cases.map((tc, idx) => (
                    <div key={idx} className="sample-case-card">
                      <div className="sample-case-header">Example {idx + 1}</div>
                      <div className="sample-case-body">
                        <div className="sample-case-col">
                          <div className="sample-case-label input-label">
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>
                            Input
                          </div>
                          <pre className="sample-case-pre">{tc.input || "(empty)"}</pre>
                        </div>
                        <div className="sample-case-col">
                          <div className="sample-case-label output-label">
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>
                            Output
                          </div>
                          <pre className="sample-case-pre">{tc.output || "(empty)"}</pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ── Solution Tab ── */
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                <div>
                  <h3 style={{ fontSize: "1.1rem" }}>Reference Solution</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginTop: "0.25rem" }}>
                    Verified C++ solution. Study it or copy to the editor.
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => copyToClipboard(question.solution_cpp)}
                    className="btn btn-secondary"
                    style={{ fontSize: "0.78rem", padding: "0.3rem 0.7rem", gap: "0.3rem" }}
                  >
                    {copied ? <Check size={12} style={{ color: "var(--color-success)" }} /> : <Copy size={12} />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button
                    onClick={() => { setCode(question.solution_cpp); setRightTab("editor"); }}
                    className="btn btn-primary"
                    style={{ fontSize: "0.78rem", padding: "0.3rem 0.7rem" }}
                  >
                    Load to Editor
                  </button>
                </div>
              </div>
              <pre style={{
                background: "#0d0d0d", padding: "1.25rem", borderRadius: "var(--radius-sm)",
                fontSize: "0.82rem", overflowX: "auto", fontFamily: "var(--font-mono)",
                border: "1px solid #2e2e2e", borderLeft: `3px solid ${accentColor}`,
                lineHeight: "1.65", maxHeight: "calc(100vh - 300px)", overflowY: "auto",
                color: "#c9d1d9"
              }}>
                {question.solution_cpp || "// No solution scraped for this problem yet."}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════ RIGHT PANE ═══════════════════ */}
      <div className="pane-right">
        <div className="pane-header" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <div onClick={() => setRightTab("editor")} className={`pane-tab ${rightTab === "editor" ? "active" : ""}`}>
              <Code size={13} /> C++ Editor
            </div>
            <div onClick={() => setRightTab("console")} className={`pane-tab ${rightTab === "console" ? "active" : ""}`}>
              <Terminal size={13} /> Console
            </div>
          </div>
          {/* Mark solved button */}
          <button
            onClick={handleToggleComplete}
            className="btn"
            style={{
              padding: "0.25rem 0.65rem", fontSize: "0.75rem", gap: "0.3rem",
              backgroundColor: isSolved ? "var(--color-success-bg)" : "transparent",
              color: isSolved ? "var(--color-success)" : "var(--text-muted)",
              border: `1px solid ${isSolved ? "rgba(44,187,93,0.4)" : "var(--border-color)"}`
            }}
          >
            {isSolved ? <CheckCircle size={12} /> : <div style={{ width: 12, height: 12, borderRadius: "50%", border: "1.5px solid currentColor" }} />}
            {isSolved ? "Solved" : "Mark Solved"}
          </button>
        </div>

        {rightTab === "editor" ? (
          <>
            {/* Code editor area */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
              {/* Line numbers */}
              <div style={{
                width: "48px", backgroundColor: "#161616", color: "#444",
                fontFamily: "var(--font-mono)", fontSize: "12px",
                padding: "1.5rem 0.5rem 1.5rem 0", textAlign: "right",
                userSelect: "none", lineHeight: "1.7",
                borderRight: "1px solid #252525", flexShrink: 0, overflowY: "hidden"
              }}>
                {lineNumbers.map((n) => <div key={n}>{n}</div>)}
              </div>
              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                className="code-editor-area"
                spellCheck="false"
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
              />
            </div>

            {/* Custom input strip */}
            <div style={{ background: "#1c1c1c", borderTop: "1px solid #2a2a2a", padding: "0.65rem 1.25rem" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.3rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Custom Input
              </div>
              <textarea
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                rows={2}
                placeholder="Enter stdin for Run Code…"
                style={{
                  fontFamily: "var(--font-mono)", fontSize: "12px",
                  backgroundColor: "#111", border: "1px solid #2a2a2a",
                  borderRadius: "4px", padding: "0.45rem 0.65rem",
                  width: "100%", color: "#c9d1d9", resize: "none",
                  outline: "none"
                }}
              />
            </div>

            {/* Footer actions */}
            <div className="editor-footer">
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                C++ · GCC 13.1
              </span>
              <div style={{ display: "flex", gap: "0.65rem" }}>
                <button
                  onClick={handleRunCode}
                  disabled={isRunning || isSubmitting}
                  className="btn btn-secondary"
                  style={{ gap: "0.35rem", fontSize: "0.82rem", padding: "0.45rem 1rem" }}
                >
                  <Play size={13} /> Run
                </button>
                <button
                  onClick={handleSubmitCode}
                  disabled={isRunning || isSubmitting}
                  className="btn btn-primary"
                  style={{ gap: "0.35rem", fontSize: "0.82rem", padding: "0.45rem 1rem" }}
                >
                  <Send size={13} /> Submit
                </button>
              </div>
            </div>
          </>
        ) : (
          /* ── Console Tab ── */
          <div className="pane-content" style={{ backgroundColor: "#111", height: "100%", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h3 style={{ fontSize: "1rem" }}>Execution Results</h3>
              <button
                onClick={() => setRightTab("editor")}
                className="btn btn-secondary"
                style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}
              >
                ← Editor
              </button>
            </div>

            {/* Loading */}
            {(isRunning || isSubmitting) && (
              <div className="flex-center" style={{ flex: 1, flexDirection: "column", gap: "1rem", paddingTop: "4rem" }}>
                <RefreshCw size={32} className="animate-spin" style={{ color: "var(--color-primary)" }} />
                <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
                  {isRunning ? "Compiling & executing…" : "Evaluating against test cases…"}
                </p>
              </div>
            )}

            {/* Run result */}
            {!isRunning && !isSubmitting && runResult && (
              <div className="animate-fade">
                {runResult.compile_error ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "var(--color-error-bg)", color: "#f87171", padding: "0.85rem 1rem", borderRadius: "6px", marginBottom: "1rem", border: "1px solid rgba(239,71,67,0.25)" }}>
                      <XCircle size={18} /> <strong>Compilation Error</strong>
                    </div>
                    <pre style={{ background: "#0a0a0a", padding: "1rem", borderRadius: "6px", color: "#f87171", fontFamily: "var(--font-mono)", fontSize: "12px", overflowX: "auto", border: "1px solid #421", whiteSpace: "pre-wrap" }}>
                      {runResult.compile_error}
                    </pre>
                  </>
                ) : (
                  <>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "0.6rem",
                      background: runResult.success ? "var(--color-success-bg)" : "var(--color-error-bg)",
                      color: runResult.success ? "#4ade80" : "#f87171",
                      padding: "0.85rem 1rem", borderRadius: "6px", marginBottom: "1.25rem",
                      border: `1px solid ${runResult.success ? "rgba(44,187,93,0.25)" : "rgba(239,71,67,0.25)"}`
                    }}>
                      {runResult.success ? <CheckCircle size={18} /> : <XCircle size={18} />}
                      <strong>{runResult.success ? "Finished Successfully" : "Runtime Error"}</strong>
                      <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        {runResult.exec_time} ms
                      </span>
                    </div>
                    <div style={{ marginBottom: "1rem" }}>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.35rem", fontWeight: 700 }}>Stdout</div>
                      <pre style={{ background: "#0a0a0a", padding: "0.85rem 1rem", borderRadius: "6px", color: "#c9d1d9", fontFamily: "var(--font-mono)", fontSize: "12px", overflowX: "auto", border: "1px solid #2a2a2a", minHeight: "60px" }}>
                        {runResult.stdout || <em style={{ color: "#444" }}>[No output]</em>}
                      </pre>
                    </div>
                    {runResult.stderr && (
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "#f87171", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.35rem", fontWeight: 700 }}>Stderr</div>
                        <pre style={{ background: "#0a0a0a", padding: "0.85rem 1rem", borderRadius: "6px", color: "#f87171", fontFamily: "var(--font-mono)", fontSize: "12px", overflowX: "auto", border: "1px solid #311" }}>
                          {runResult.stderr}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Submit result */}
            {!isRunning && !isSubmitting && submitResult && (
              <div className="animate-fade">
                {submitResult.compile_error ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "var(--color-error-bg)", color: "#f87171", padding: "0.85rem 1rem", borderRadius: "6px", marginBottom: "1rem", border: "1px solid rgba(239,71,67,0.25)" }}>
                      <XCircle size={18} /> <strong>Compilation Error</strong>
                    </div>
                    <pre style={{ background: "#0a0a0a", padding: "1rem", borderRadius: "6px", color: "#f87171", fontFamily: "var(--font-mono)", fontSize: "12px", overflowX: "auto", border: "1px solid #421", whiteSpace: "pre-wrap" }}>
                      {submitResult.compile_error}
                    </pre>
                  </>
                ) : (
                  <>
                    <div className="animate-pop" style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
                      background: submitResult.success ? "var(--color-success-bg)" : "var(--color-error-bg)",
                      border: `1px solid ${submitResult.success ? "rgba(44,187,93,0.4)" : "rgba(239,71,67,0.4)"}`,
                      color: submitResult.success ? "#4ade80" : "#f87171",
                      padding: "1.75rem", borderRadius: "var(--radius-md)", marginBottom: "1.5rem",
                      animation: submitResult.success ? "successPulse 2s infinite" : "none"
                    }}>
                      {submitResult.success ? <CheckCircle size={40} /> : <XCircle size={40} />}
                      <h3 style={{ margin: 0, fontSize: "1.3rem" }}>{submitResult.success ? "Accepted ✓" : "Wrong Answer"}</h3>
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center" }}>{submitResult.message}</p>
                    </div>

                    <h4 style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "0.75rem", fontWeight: 700 }}>Test Cases</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {submitResult.results.map((res, idx) => (
                        <div key={idx} style={{
                          background: "#1a1a1a", border: `1px solid ${res.passed ? "rgba(44,187,93,0.25)" : "rgba(239,71,67,0.25)"}`,
                          borderRadius: "var(--radius-sm)", overflow: "hidden"
                        }}>
                          <div style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "0.6rem 1rem",
                            background: res.passed ? "rgba(44,187,93,0.06)" : "rgba(239,71,67,0.06)",
                            borderBottom: "1px solid #2a2a2a"
                          }}>
                            <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Case {idx + 1}</span>
                            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.78rem", fontWeight: 700, color: res.passed ? "var(--color-success)" : "var(--color-error)" }}>
                              {res.passed ? <Check size={12} /> : <X size={12} />}
                              {res.passed ? "Passed" : "Failed"}
                            </span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, fontSize: "0.8rem" }}>
                            <div style={{ padding: "0.75rem", borderRight: "1px solid #2a2a2a" }}>
                              <div style={{ color: "#5b8bff", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>Input</div>
                              <pre style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#c9d1d9", margin: 0, whiteSpace: "pre-wrap" }}>{res.input}</pre>
                            </div>
                            <div style={{ padding: "0.75rem" }}>
                              <div style={{ color: "#4ade80", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>Expected</div>
                              <pre style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#c9d1d9", margin: 0, whiteSpace: "pre-wrap" }}>{res.expected_output}</pre>
                            </div>
                          </div>
                          {!res.passed && res.actual_output && (
                            <div style={{ padding: "0.75rem", borderTop: "1px solid #2a2a2a" }}>
                              <div style={{ color: "#f87171", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>Your Output</div>
                              <pre style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#f87171", margin: 0, whiteSpace: "pre-wrap" }}>{res.actual_output}</pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Empty state */}
            {!isRunning && !isSubmitting && !runResult && !submitResult && (
              <div className="flex-center" style={{ flex: 1, flexDirection: "column", gap: "0.75rem", color: "var(--text-muted)", paddingTop: "5rem" }}>
                <Terminal size={36} style={{ opacity: 0.3 }} />
                <p style={{ fontSize: "0.88rem" }}>Run or submit your code to see output here.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

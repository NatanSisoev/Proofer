"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Markdown from "./Markdown";
import VoiceInput from "./VoiceInput";
import AnswerBox from "./AnswerBox";
import Confetti from "./Confetti";

type QueueNode = { id: string; title: string; type: string | null; area: string | null };

type Problem = {
  problemId: number;
  problem: string;
  kind: string;
  mode: "ai" | "demo";
  masteryBefore: number;
  node: { id: string; title: string; type: string | null; area: string | null };
};

type Grade = {
  verdict: "correct" | "partial" | "incorrect";
  mastery_evidence: number;
  understood: string[];
  gap: string;
  blamed_prerequisite: string;
  socratic_hint: string;
  masteryBefore: number;
  masteryAfter: number;
  halfLife?: number;
  justMastered?: boolean;
  unlocked?: { id: string; title: string; type: string | null; area: string | null }[];
};

type SessionResult = {
  node: QueueNode;
  verdict: "correct" | "partial" | "incorrect";
  masteryBefore: number;
  masteryAfter: number;
  justMastered?: boolean;
};

const VERDICT_STYLE: Record<string, { bg: string; label: string; color: string }> = {
  correct: { bg: "#173a2c", label: "Correct", color: "#57d9a3" },
  partial: { bg: "#3a341c", label: "Partially there", color: "#f2c94c" },
  incorrect: { bg: "#3a1c1c", label: "Not yet", color: "#ff6b6b" },
};

const VERDICT_ICON: Record<string, string> = {
  correct: "✓",
  partial: "~",
  incorrect: "✗",
};

export default function StudyQueue({ queue, preferKind }: { queue: QueueNode[]; preferKind?: string }) {
  const [index, setIndex] = useState(0);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [done, setDone] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [hintBusy, setHintBusy] = useState(false);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [sessionStart] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  // Prefetch cache: map nodeId → fetched Problem data
  const prefetchCache = useRef<Map<string, Promise<any>>>(new Map());
  const currentNode = queue[index];

  /** Fire-and-forget: start generating a problem for nodeId, storing the
   *  promise in prefetchCache so generate() can await it instead of re-fetching. */
  const prefetch = useCallback((nodeId: string) => {
    if (prefetchCache.current.has(nodeId)) return;
    const p = fetch("/api/practice/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId, ...(preferKind ? { kind: preferKind } : {}) }),
    }).then((r) => r.json()).catch(() => null);
    prefetchCache.current.set(nodeId, p);
  }, [preferKind]);

  const generate = useCallback(async (nodeId: string, signal?: AbortSignal) => {
    setBusy(true);
    setError(null);
    setGrade(null);
    setAnswer("");
    setProblem(null);
    setRevealed(null);
    setFollowUp("");
    setFollowUpBusy(false);
    setShowReminder(false);
    setHint(null);
    setHintBusy(false);
    setCopied(false);
    try {
      // Use prefetch cache if available, otherwise fetch fresh.
      const cached = prefetchCache.current.get(nodeId);
      prefetchCache.current.delete(nodeId); // consume it
      const data = await (cached ?? fetch("/api/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, ...(preferKind ? { kind: preferKind } : {}) }),
        signal,
      }).then((r) => r.json()));
      if (!data || data.error) throw new Error(data?.error || "generation failed");
      if (!signal?.aborted) setProblem(data);
    } catch (e: any) {
      if (e.name === "AbortError") return;
      if (!signal?.aborted) setError(e.message || "Something went wrong");
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (done || !currentNode) return;
    const ctrl = new AbortController();
    generate(currentNode.id, ctrl.signal);
    return () => ctrl.abort();
  }, [index, generate, currentNode, done]);

  // Prefetch next problem while the user is answering the current one.
  useEffect(() => {
    if (!problem || done) return;
    const nextNode = queue[index + 1];
    if (nextNode) prefetch(nextNode.id);
  }, [problem, index, queue, done, prefetch]);

  // Session elapsed timer
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setSessionElapsed(Math.floor((Date.now() - sessionStart) / 1000)), 1000);
    return () => clearInterval(id);
  }, [done, sessionStart]);

  // Ctrl+Enter to submit
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!grade && !busy && answer.trim()) submit();
        else if (grade) advance();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  async function getHint() {
    if (!problem || hintBusy) return;
    setHintBusy(true);
    try {
      const res = await fetch("/api/practice/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: problem.problemId }),
      });
      const data = await res.json();
      setHint(res.ok ? (data.hint || "") : "Could not get a hint right now.");
    } catch { setHint("Could not get a hint right now."); }
    finally { setHintBusy(false); }
  }

  async function reveal() {
    if (!problem) return;
    setBusy(true);
    try {
      const res = await fetch("/api/practice/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: problem.problemId }),
      });
      const data = await res.json();
      if (res.ok) {
        setRevealed(data.idealSolution);
        setResults((prev) => [
          ...prev,
          { node: currentNode, verdict: "incorrect", masteryBefore: data.masteryBefore, masteryAfter: data.masteryAfter },
        ]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitFollowUp() {
    if (!problem || !followUp.trim()) return;
    setFollowUpBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/practice/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: problem.problemId, answer: followUp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "grading failed");
      setGrade(data);
      setFollowUp("");
      // Update the last result with the new verdict
      setResults((prev) => {
        const updated = [...prev];
        if (updated.length > 0) {
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            verdict: data.verdict,
            masteryAfter: data.masteryAfter,
          };
        }
        return updated;
      });
    } catch (e: any) {
      setError(e.message || "Grading failed");
    } finally {
      setFollowUpBusy(false);
    }
  }

  async function submit() {
    if (!problem || !answer.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/practice/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: problem.problemId, answer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "grading failed");
      setGrade(data);
      setResults((prev) => [
        ...prev,
        {
          node: currentNode,
          verdict: data.verdict,
          masteryBefore: data.masteryBefore,
          masteryAfter: data.masteryAfter,
          justMastered: data.justMastered ?? false,
        },
      ]);
    } catch (e: any) {
      setError(e.message || "Grading failed");
    } finally {
      setBusy(false);
    }
  }

  function advance() {
    if (index + 1 >= queue.length) {
      setDone(true);
    } else {
      setIndex((i) => i + 1);
    }
  }

  if (done) {
    const correct = results.filter((r) => r.verdict === "correct").length;
    const partial = results.filter((r) => r.verdict === "partial").length;
    const incorrect = results.filter((r) => r.verdict === "incorrect").length;
    const masteredCount = results.filter((r) => r.justMastered).length;
    const totalMasteryGain = results.reduce((sum, r) => sum + (r.masteryAfter - r.masteryBefore), 0);
    const accuracy = results.length > 0 ? Math.round((correct / results.length) * 100) : 0;
    const isPerfect = correct === results.length && results.length > 0;

    return (
      <div className="session-summary">
        {isPerfect && <Confetti count={90} />}
        <div style={{ marginBottom: 6 }}>
          {isPerfect && (
            <div style={{ fontSize: 32, marginBottom: 8, animation: "none" }}>🎉</div>
          )}
          <h2 style={{ margin: "0 0 2px", fontSize: 22 }}>
            {isPerfect ? "Perfect session!" : "Session complete"}
          </h2>
          <p className="muted" style={{ margin: "0 0 20px", fontSize: 13 }}>
            {queue.length} concept{queue.length !== 1 ? "s" : ""} ·{" "}
            {Math.floor(sessionElapsed / 60)}m {sessionElapsed % 60}s ·{" "}
            {accuracy}% accuracy
            {totalMasteryGain > 0.01 && ` · +${Math.round(totalMasteryGain * 100)}pp avg mastery`}
            {masteredCount > 0 && ` · ${masteredCount} newly mastered`}
          </p>
        </div>

        <div className="session-score">
          <div className="score-chip" style={{ borderColor: "#173a2c", color: "#57d9a3" }}>
            <span className="score-n">{correct}</span>
            <span className="score-l">correct</span>
          </div>
          <div className="score-chip" style={{ borderColor: "#3a341c", color: "#f2c94c" }}>
            <span className="score-n">{partial}</span>
            <span className="score-l">partial</span>
          </div>
          <div className="score-chip" style={{ borderColor: "#3a1c1c", color: "#ff6b6b" }}>
            <span className="score-n">{incorrect}</span>
            <span className="score-l">needs work</span>
          </div>
          {masteredCount > 0 && (
            <div className="score-chip" style={{ borderColor: "#2a5a3a", color: "var(--green)" }}>
              <span className="score-n">{masteredCount}</span>
              <span className="score-l">mastered</span>
            </div>
          )}
        </div>

        {results.some((r) => r.justMastered) && (
          <div style={{ marginTop: 20, padding: "12px 14px", background: "#0a1f12", border: "1px solid #2a5a3a", borderRadius: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--green)", marginBottom: 8 }}>
              🔓 Newly mastered this session
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {results.filter((r) => r.justMastered).map((r, i) => (
                <Link
                  key={i}
                  href={`/node/${encodeURIComponent(r.node.id)}`}
                  style={{
                    padding: "4px 10px", borderRadius: 7,
                    border: "1px solid #2a5a3a", background: "#112a1a",
                    color: "var(--green)", fontSize: 13, textDecoration: "none",
                  }}
                >
                  {r.node.title}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="panel" style={{ marginTop: 24 }}>
          <h2>Results</h2>
          {results.map((r, i) => (
            <div key={i} className="session-result-row">
              <span
                className="verdict-dot"
                style={{ background: VERDICT_STYLE[r.verdict]?.bg, color: VERDICT_STYLE[r.verdict]?.color }}
              >
                {VERDICT_ICON[r.verdict]}
              </span>
              <Link href={`/node/${encodeURIComponent(r.node.id)}`} style={{ color: "var(--text)" }}>
                {r.node.title}
              </Link>
              {r.node.area && <span className="muted small"> · {r.node.area}</span>}
              {r.justMastered && <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 700 }}>🔓 mastered</span>}
              <span className="muted small" style={{ marginLeft: "auto" }}>
                {Math.round(r.masteryBefore * 100)}% → <strong>{Math.round(r.masteryAfter * 100)}%</strong>
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          {incorrect + partial > 0 && (
            <button
              className="btn-ghost"
              onClick={() => {
                const retryNodes = results
                  .filter((r) => r.verdict === "incorrect" || r.verdict === "partial")
                  .map((r) => r.node);
                if (retryNodes.length > 0) {
                  setResults([]);
                  setIndex(0);
                  setDone(false);
                  setSessionElapsed(0);
                  // Replace queue with retry nodes (re-use index cycling)
                  // We can't mutate queue prop, but we can reset index and done
                  // and rely on the queue being reset externally — instead, navigate
                  window.location.href = `/learn?node=${encodeURIComponent(retryNodes[0].id)}`;
                }
              }}
              style={{ fontSize: 13, color: "var(--amber)", borderColor: "#4a3a1a" }}
            >
              🔁 Retry {incorrect + partial} missed
            </button>
          )}
          <Link href="/session" className="btn-primary" style={{ textDecoration: "none", padding: "8px 18px", borderRadius: 8, background: "var(--accent)", color: "#000", fontSize: 14, fontWeight: 600 }}>
            New session
          </Link>
          <Link href="/history" className="btn-ghost" style={{ textDecoration: "none", padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)", color: "var(--text)", fontSize: 14 }}>
            History
          </Link>
          <Link href="/" className="btn-ghost" style={{ textDecoration: "none", padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)", color: "var(--text)", fontSize: 14 }}>
            Home
          </Link>
        </div>
      </div>
    );
  }

  const progress = index / queue.length;

  return (
    <div className="practice">
      {/* Session progress bar */}
      <div className="session-progress">
        <div className="session-progress-bar" style={{ width: `${(index / queue.length) * 100}%` }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="muted small">Concept {index + 1} of {queue.length}</span>
          <span className="muted small" style={{ fontVariantNumeric: "tabular-nums" }}>
            {Math.floor(sessionElapsed / 60)}:{String(sessionElapsed % 60).padStart(2, "0")}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {results.map((r, i) => (
            <span
              key={i}
              title={r.node.title}
              style={{
                width: 10, height: 10, borderRadius: "50%",
                background: VERDICT_STYLE[r.verdict]?.color,
                display: "inline-block",
              }}
            />
          ))}
          {Array.from({ length: queue.length - results.length }).map((_, i) => (
            <span
              key={`empty-${i}`}
              style={{
                width: 10, height: 10, borderRadius: "50%",
                background: "var(--border)",
                display: "inline-block",
              }}
            />
          ))}
        </div>
      </div>

      {busy && !problem && <div className="panel muted">Generating a problem…</div>}
      {error && (
        <div className="panel" style={{ borderColor: "#5a2a2a", color: "#ff9b9b" }}>
          <div style={{ marginBottom: 8 }}>{error}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-ghost" onClick={() => generate(currentNode.id, undefined)} disabled={busy} style={{ fontSize: 13 }}>
              Retry
            </button>
            <button className="btn-ghost" onClick={advance} disabled={busy} style={{ fontSize: 13 }}>
              Skip this concept
            </button>
          </div>
        </div>
      )}

      {problem && (
        <>
          <div className="practice-head">
            <div>
              <span className="muted small">Practicing</span>{" "}
              <Link href={`/node/${encodeURIComponent(problem.node.id)}`}>
                <strong>{problem.node.title}</strong>
              </Link>
              {problem.node.area && <span className="muted small"> · {problem.node.area}</span>}
              {problem.mode === "demo" && <span className="pill" style={{ marginLeft: 10 }}>demo mode</span>}
            </div>
            <span className="pill">{problem.kind}</span>
          </div>

          <div className="panel" style={{ position: "relative" }}>
            <Markdown>{problem.problem}</Markdown>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(problem.problem).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              title="Copy problem to clipboard"
              style={{
                position: "absolute", top: 10, right: 10,
                background: "none", cursor: "pointer",
                fontSize: 12, color: "var(--muted)", padding: "3px 7px",
                borderRadius: 5, border: "1px solid var(--border)",
              }}
            >
              {copied ? "✓" : "⎘"}
            </button>
          </div>

          {/* Concept reminder toggle */}
          {!grade && !revealed && (
            <div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowReminder((s) => !s)}
                style={{ fontSize: 12, color: "var(--muted)", marginBottom: showReminder ? 4 : 0 }}
              >
                {showReminder ? "Hide reminder ↑" : "Concept reminder ↓"}
              </button>
              {showReminder && (
                <div className="panel" style={{ fontSize: 13.5, borderColor: "#2a3050", background: "#0d1020", marginBottom: 4 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 }}>
                    {problem.node.type && <span className={`type-badge t-${problem.node.type}`}>{problem.node.type}</span>}
                    <Link href={`/node/${encodeURIComponent(problem.node.id)}`} target="_blank" style={{ fontWeight: 600, fontSize: 14 }}>
                      {problem.node.title}
                    </Link>
                    {problem.node.area && <span className="muted small">{problem.node.area}</span>}
                  </div>
                  <p className="muted small" style={{ margin: 0, fontStyle: "italic" }}>
                    Click to open the full note in a new tab.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Hint panel */}
          {hint && !grade && (
            <div className="panel" style={{ borderColor: "#3a3020", background: "#1a1400", marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--amber)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  💡 Hint
                </span>
                <button className="btn-ghost" onClick={() => setHint(null)} style={{ fontSize: 11, padding: "2px 6px", color: "var(--muted)" }}>
                  ✕
                </button>
              </div>
              <div className="markdown" style={{ fontSize: 14 }}><Markdown>{hint}</Markdown></div>
            </div>
          )}

          <AnswerBox
            value={answer}
            onChange={setAnswer}
            disabled={!!grade || busy}
            placeholder="Write your answer — proof, definition, counterexample. Type $...$ for math."
            autoFocus
          />

          {revealed && (
            <div className="panel" style={{ borderColor: "#2a3a2a", background: "#0d1a0d", marginTop: 4 }}>
              <h4 style={{ color: "var(--green)", margin: "0 0 8px" }}>Ideal solution</h4>
              <div className="markdown"><Markdown>{revealed}</Markdown></div>
              <button className="btn-ghost" onClick={advance} disabled={busy} style={{ marginTop: 10, fontSize: 13 }}>
                {index + 1 >= queue.length ? "Finish session →" : "Next concept →"}
              </button>
            </div>
          )}

          {!grade && !revealed && (
            <div className="practice-actions">
              <button className="btn-primary" onClick={submit} disabled={busy || !answer.trim()}>
                {busy ? "Grading…" : "Submit"}
              </button>
              <VoiceInput
                onTranscript={(t) => setAnswer((prev) => prev ? prev + " " + t : t)}
                disabled={busy}
              />
              {problem.mode !== "demo" && !hint && (
                <button
                  className="btn-ghost"
                  onClick={getHint}
                  disabled={busy || hintBusy}
                  style={{ fontSize: 13, color: "var(--amber)" }}
                >
                  {hintBusy ? "…" : "💡 Hint"}
                </button>
              )}
              <button className="btn-ghost" onClick={advance} disabled={busy}>
                Skip →
              </button>
              <button className="btn-ghost" onClick={reveal} disabled={busy} style={{ color: "var(--muted)", fontSize: 13 }}>
                I don't know
              </button>
              <span className="muted small" style={{ marginLeft: "auto", alignSelf: "center" }}>Ctrl+Enter</span>
            </div>
          )}

          {grade && (
            <div className="panel feedback">
              <div className={`verdict${grade.verdict === "correct" ? " verdict-correct" : ""}`} style={{ background: VERDICT_STYLE[grade.verdict]?.bg }}>
                {VERDICT_STYLE[grade.verdict]?.label || grade.verdict}
              </div>

              <div className="mastery-move">
                <span className="muted small">Mastery</span>
                <div className="bar"><span style={{ width: `${Math.round(grade.masteryAfter * 100)}%` }} /></div>
                <span className="small">
                  {Math.round(grade.masteryBefore * 100)}% → <strong>{Math.round(grade.masteryAfter * 100)}%</strong>
                </span>
                {grade.halfLife && (
                  <span className="muted small" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
                    ⏱ review in ~{grade.halfLife}d
                  </span>
                )}
              </div>

              {grade.understood?.length > 0 && (
                <div className="fb-block">
                  <h4 style={{ color: "#57d9a3" }}>What you got</h4>
                  <ul>{grade.understood.map((u, i) => <li key={i}>{u}</li>)}</ul>
                </div>
              )}

              <div className="fb-block">
                <h4 style={{ color: "#f2c94c" }}>The gap</h4>
                <div className="markdown"><Markdown>{grade.gap}</Markdown></div>
                {grade.blamed_prerequisite && (
                  <p className="small" style={{ marginTop: 8 }}>
                    This traces back to{" "}
                    <Link href={`/learn?node=${encodeURIComponent(grade.blamed_prerequisite)}`}>
                      <strong>{grade.blamed_prerequisite}</strong>
                    </Link>{" "}
                    — practice that first.
                  </p>
                )}
              </div>

              <div className="fb-block">
                <h4 style={{ color: "#6ea8fe" }}>Hint (not the answer)</h4>
                <div className="markdown"><Markdown>{grade.socratic_hint}</Markdown></div>
              </div>

              {grade.verdict !== "correct" && (
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 4 }}>
                  <p className="muted small" style={{ margin: "0 0 8px" }}>
                    Address the gap — no need to start over:
                  </p>
                  <AnswerBox
                    value={followUp}
                    onChange={setFollowUp}
                    disabled={followUpBusy}
                    placeholder="Show the missing step, fix the misconception…"
                    style={{ minHeight: 90 }}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault();
                        if (followUp.trim()) submitFollowUp();
                      }
                    }}
                  />
                  <div className="practice-actions" style={{ marginTop: 8 }}>
                    <button
                      className="btn-primary"
                      onClick={submitFollowUp}
                      disabled={followUpBusy || !followUp.trim()}
                    >
                      {followUpBusy ? "Checking…" : "Submit follow-up"}
                    </button>
                    <VoiceInput
                      onTranscript={(t) => setFollowUp((prev) => prev ? prev + " " + t : t)}
                      disabled={followUpBusy}
                    />
                    <span className="muted small" style={{ alignSelf: "center" }}>Ctrl+Enter</span>
                  </div>
                </div>
              )}

              {/* Unlock celebration */}
              {grade.justMastered && grade.unlocked && grade.unlocked.length > 0 && (
                <div style={{
                  marginTop: 4, padding: "12px 14px",
                  background: "#0a1f12", border: "1px solid #2a5a3a", borderRadius: 10,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--green)", marginBottom: 8 }}>
                    🔓 Mastered! {grade.unlocked.length} new concept{grade.unlocked.length !== 1 ? "s" : ""} unlocked
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {grade.unlocked.map((n) => (
                      <Link
                        key={n.id}
                        href={`/node/${encodeURIComponent(n.id)}`}
                        target="_blank"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "4px 10px", borderRadius: 7,
                          border: "1px solid #2a5a3a", background: "#112a1a",
                          color: "var(--green)", fontSize: 13, textDecoration: "none",
                        }}
                      >
                        {n.type && <span style={{ fontSize: 10, opacity: 0.7 }}>{n.type}</span>}
                        {n.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="practice-actions" style={{ marginTop: 12 }}>
                <button className="btn-primary" onClick={advance} disabled={busy}>
                  {index + 1 >= queue.length ? "Finish session →" : "Next concept →"}
                </button>
                <span className="muted small" style={{ alignSelf: "center" }}>Ctrl+Enter</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

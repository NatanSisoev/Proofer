"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Markdown from "./Markdown";
import VoiceInput from "./VoiceInput";
import AnswerBox from "./AnswerBox";

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
};

type SessionResult = {
  node: QueueNode;
  verdict: "correct" | "partial" | "incorrect";
  masteryBefore: number;
  masteryAfter: number;
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

export default function StudyQueue({ queue }: { queue: QueueNode[] }) {
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
  const currentNode = queue[index];

  const generate = useCallback(async (nodeId: string, signal?: AbortSignal) => {
    setBusy(true);
    setError(null);
    setGrade(null);
    setAnswer("");
    setProblem(null);
    setRevealed(null);
    setFollowUp("");
    setFollowUpBusy(false);
    try {
      const res = await fetch("/api/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId }),
        signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "generation failed");
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

    return (
      <div className="session-summary">
        <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>Session complete</h2>
        <p className="muted" style={{ margin: "0 0 24px" }}>
          {queue.length} concept{queue.length !== 1 ? "s" : ""} practiced
        </p>

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
        </div>

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
              <span className="muted small" style={{ marginLeft: "auto" }}>
                {Math.round(r.masteryBefore * 100)}% → <strong>{Math.round(r.masteryAfter * 100)}%</strong>
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <Link href="/session" className="btn-primary" style={{ textDecoration: "none", padding: "8px 18px", borderRadius: 8, background: "var(--accent)", color: "#000", fontSize: 14, fontWeight: 600 }}>
            New session
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
        <span className="muted small">Concept {index + 1} of {queue.length}</span>
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

          <div className="panel">
            <Markdown>{problem.problem}</Markdown>
          </div>

          <AnswerBox
            value={answer}
            onChange={setAnswer}
            disabled={!!grade || busy}
            placeholder="Write your answer — proof, definition, counterexample. Type $...$ for math."
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

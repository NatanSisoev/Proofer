"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import VoiceInput from "./VoiceInput";
import { VERDICT } from "@/lib/verdict";
import { ProblemPanel, GradeFeedback, type Problem, type Grade, type ProblemNode } from "./ProblemCard";

type QueueNode = ProblemNode;

type SessionResult = {
  node: QueueNode;
  verdict: "correct" | "partial" | "incorrect";
  masteryBefore: number;
  masteryAfter: number;
  justMastered?: boolean;
  elapsedSec?: number;
};

export default function StudyQueue({ queue, preferKind }: { queue: QueueNode[]; preferKind?: string }) {
  const [activeQueue, setActiveQueue] = useState<QueueNode[]>(queue);
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
  const questionStart = useRef<number>(Date.now());
  const currentNode = activeQueue[index];

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
      if (!signal?.aborted) { setProblem(data); questionStart.current = Date.now(); }
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

  // Drop prefetch entries for nodes we've skipped past (e.g. double-skip
  // jumping over the prefetched "next" node) so they don't sit unconsumed.
  useEffect(() => {
    const keep = new Set([currentNode?.id, activeQueue[index + 1]?.id].filter(Boolean));
    for (const id of prefetchCache.current.keys()) {
      if (!keep.has(id)) prefetchCache.current.delete(id);
    }
  }, [index, currentNode, activeQueue]);

  // Prefetch next problem while the user is answering the current one.
  useEffect(() => {
    if (!problem || done) return;
    const nextNode = activeQueue[index + 1];
    if (nextNode) prefetch(nextNode.id);
  }, [problem, index, activeQueue, done, prefetch]);

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
        const elapsedSec = Math.round((Date.now() - questionStart.current) / 1000);
        setResults((prev) => [
          ...prev,
          { node: currentNode, verdict: "incorrect", masteryBefore: data.masteryBefore, masteryAfter: data.masteryAfter, elapsedSec },
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
      const elapsedSec = Math.round((Date.now() - questionStart.current) / 1000);
      setResults((prev) => [
        ...prev,
        {
          node: currentNode,
          verdict: data.verdict,
          masteryBefore: data.masteryBefore,
          masteryAfter: data.masteryAfter,
          justMastered: data.justMastered ?? false,
          elapsedSec,
        },
      ]);
    } catch (e: any) {
      setError(e.message || "Grading failed");
    } finally {
      setBusy(false);
    }
  }

  function advance() {
    if (index + 1 >= activeQueue.length) {
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
    const timedResults = results.filter((r) => r.elapsedSec !== undefined);
    const avgTimeSec = timedResults.length > 0
      ? Math.round(timedResults.reduce((s, r) => s + (r.elapsedSec ?? 0), 0) / timedResults.length)
      : null;

    return (
      <div className="session-summary">
        <div style={{ marginBottom: 6 }}>
          <h2>{isPerfect ? "Perfect session!" : "Session complete"}</h2>
          <p className="muted session-subtitle">
            {activeQueue.length} concept{activeQueue.length !== 1 ? "s" : ""} ·{" "}
            {Math.floor(sessionElapsed / 60)}m {sessionElapsed % 60}s ·{" "}
            {accuracy}% accuracy
            {avgTimeSec !== null && ` · ~${avgTimeSec}s/problem`}
            {totalMasteryGain > 0.01 && ` · +${Math.round(totalMasteryGain * 100)}pp avg mastery`}
            {masteredCount > 0 && ` · ${masteredCount} newly mastered`}
          </p>
        </div>

        <div className="session-score">
          <div className="score-chip correct">
            <span className="score-n">{correct}</span>
            <span className="score-l">correct</span>
          </div>
          <div className="score-chip partial">
            <span className="score-n">{partial}</span>
            <span className="score-l">partial</span>
          </div>
          <div className="score-chip incorrect">
            <span className="score-n">{incorrect}</span>
            <span className="score-l">needs work</span>
          </div>
          {masteredCount > 0 && (
            <div className="score-chip mastered">
              <span className="score-n">{masteredCount}</span>
              <span className="score-l">mastered</span>
            </div>
          )}
        </div>

        {results.some((r) => r.justMastered) && (
          <div className="mastered-banner">
            <div className="mastered-banner-title">Newly mastered this session</div>
            <div className="chips-row">
              {results.filter((r) => r.justMastered).map((r, i) => (
                <Link key={i} href={`/node/${encodeURIComponent(r.node.id)}`} className="mastered-node-chip">
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
                style={{ background: VERDICT[r.verdict]?.bg, color: VERDICT[r.verdict]?.color }}
              >
                {VERDICT[r.verdict]?.icon}
              </span>
              <Link href={`/node/${encodeURIComponent(r.node.id)}`} className="text-link">
                {r.node.title}
              </Link>
              {r.node.area && <span className="muted small"> · {r.node.area}</span>}
              {r.justMastered && <span className="mastered-badge">mastered</span>}
              <span className="muted small result-mastery">
                {r.elapsedSec !== undefined && (
                  <span style={{ fontSize: 10, opacity: 0.6 }}>{r.elapsedSec}s</span>
                )}
                {Math.round(r.masteryBefore * 100)}% → <strong>{Math.round(r.masteryAfter * 100)}%</strong>
              </span>
            </div>
          ))}
        </div>

        <div className="session-actions">
          {incorrect + partial > 0 && (
            <button
              className="btn-ghost"
              onClick={() => {
                const retryNodes = results
                  .filter((r) => r.verdict === "incorrect" || r.verdict === "partial")
                  .map((r) => r.node);
                if (retryNodes.length > 0) {
                  setActiveQueue(retryNodes);
                  setResults([]);
                  setIndex(0);
                  setDone(false);
                  setSessionElapsed(0);
                }
              }}
              style={{ fontSize: 13, color: "var(--amber)" }}
            >
              Retry {incorrect + partial} missed
            </button>
          )}
          <Link href="/session" className="btn-primary">New session</Link>
          <Link href="/history" className="btn-ghost">History</Link>
          <Link href="/" className="btn-ghost">Home</Link>
        </div>
      </div>
    );
  }

  const progress = index / activeQueue.length;

  return (
    <div className="practice">
      {/* Session progress bar */}
      <div className="session-progress">
        <div className="session-progress-bar" style={{ width: `${(index / activeQueue.length) * 100}%` }} />
      </div>
      <div className="session-progress-header">
        <div className="session-progress-left">
          <span className="muted small">Concept {index + 1} of {activeQueue.length}</span>
          <span className="muted small" style={{ fontVariantNumeric: "tabular-nums" }}>
            {Math.floor(sessionElapsed / 60)}:{String(sessionElapsed % 60).padStart(2, "0")}
          </span>
        </div>
        <div className="dots-row">
          {results.map((r, i) => (
            <span
              key={i}
              title={r.node.title}
              className="progress-dot"
              style={{ background: VERDICT[r.verdict]?.color }}
            />
          ))}
          {Array.from({ length: activeQueue.length - results.length }).map((_, i) => (
            <span key={`empty-${i}`} className="progress-dot" style={{ background: "var(--border)" }} />
          ))}
        </div>
      </div>

      {busy && !problem && <div className="panel muted">Generating a problem…</div>}
      {error && (
        <div className="panel error-notice">
          <div style={{ marginBottom: 8 }}>{error}</div>
          <div className="btn-row">
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

          <ProblemPanel
            problem={problem}
            answer={answer}
            onAnswerChange={setAnswer}
            answerDisabled={!!grade || busy}
            answerPlaceholder="Write your answer — proof, definition, counterexample. Type $...$ for math."
            copied={copied}
            onCopy={() => navigator.clipboard.writeText(problem.problem).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
            showConceptReminder={!grade && !revealed}
            reminderOpen={showReminder}
            onToggleReminder={() => setShowReminder((s) => !s)}
            reminderCaption="Click to open the full note in a new tab."
            reminderLinkTarget="_blank"
            hint={!grade ? hint : null}
            onDismissHint={() => setHint(null)}
            revealed={revealed}
            revealedFooter={
              <button className="btn-ghost" onClick={advance} disabled={busy} style={{ marginTop: 10, fontSize: 13 }}>
                {index + 1 >= activeQueue.length ? "Finish session →" : "Next concept →"}
              </button>
            }
          />

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
                  {hintBusy ? "…" : "Hint"}
                </button>
              )}
              <button className="btn-ghost" onClick={advance} disabled={busy}>
                Skip →
              </button>
              <button className="btn-ghost" onClick={reveal} disabled={busy} style={{ color: "var(--muted)", fontSize: 13 }}>
                I don't know
              </button>
              <span className="muted small keyboard-hint" style={{ marginLeft: "auto" }}>Ctrl+Enter</span>
            </div>
          )}

          {grade && (
            <div className="panel feedback">
              <GradeFeedback
                grade={grade}
                followUp={followUp}
                onFollowUpChange={setFollowUp}
                followUpBusy={followUpBusy}
                onSubmitFollowUp={submitFollowUp}
                followUpPlaceholder="Show the missing step, fix the misconception…"
                followUpLeadText="Address the gap — no need to start over:"
                followUpMinHeight={90}
                unlockTarget="_blank"
              />

              <div className="practice-actions" style={{ marginTop: 12 }}>
                <button className="btn-primary" onClick={advance} disabled={busy}>
                  {index + 1 >= activeQueue.length ? "Finish session →" : "Next concept →"}
                </button>
                <span className="muted small keyboard-hint">Ctrl+Enter</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

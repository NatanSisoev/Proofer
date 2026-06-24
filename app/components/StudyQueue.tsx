"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import VoiceInput from "./VoiceInput";
import Spinner from "./Spinner";
import { VERDICT } from "@/lib/verdict";
import { ProblemPanel, GradeFeedback, ConfidenceSelect, type Problem, type Grade } from "./ProblemCard";
import { ArrowLeft, ArrowRight, Check, X, VerdictIcon, CircularProgress } from "./Icons";
import {
  SESSION_KEY,
  type QueueNode,
  type SessionResult,
  type CardState,
  type SavedSession,
} from "./session-types";

export default function StudyQueue({
  queue,
  preferKind,
  savedState,
  examMode,
  enableCalibration,
}: {
  queue: QueueNode[];
  preferKind?: string;
  savedState?: SavedSession | null;
  examMode?: { timeLimitSec: number };
  enableCalibration?: boolean;
}) {
  const [activeQueue, setActiveQueue] = useState<QueueNode[]>(savedState?.activeQueue ?? queue);
  const [index, setIndex] = useState(savedState?.index ?? 0);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [followUpBusy, setFollowUpBusy] = useState(false);
  // Results keyed by queue index so back-nav updates the right card
  const [resultsByIndex, setResultsByIndex] = useState<Record<number, SessionResult>>(
    savedState?.resultsByIndex ?? {}
  );
  const [done, setDone] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [hintBusy, setHintBusy] = useState(false);
  // Pre-answer confidence (0..1) for calibration; reset per card, sent on submit.
  const [confidence, setConfidence] = useState<number | null>(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [sessionStart] = useState(() => Date.now());
  const [examTimedOut, setExamTimedOut] = useState(false);
  const [copied, setCopied] = useState(false);
  const [unlockedNodes, setUnlockedNodes] = useState<{ id: string; title: string; area: string | null; type: string | null }[]>([]);

  // Per-card state snapshots — mutated imperatively, not re-render triggers
  const cardStatesRef = useRef<Record<number, CardState>>(savedState?.cardStates ?? {});
  const prefetchCache = useRef<Map<string, Promise<any>>>(new Map());
  const questionStart = useRef<number>(Date.now());
  const currentNode = activeQueue[index];

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
    setConfidence(null);
    try {
      const cached = prefetchCache.current.get(nodeId);
      prefetchCache.current.delete(nodeId);
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
  }, [preferKind]);

  // Load card on index change — restore snapshot or generate fresh
  useEffect(() => {
    if (done || !currentNode) return;
    const saved = cardStatesRef.current[index];
    if (saved?.problem) {
      setProblem(saved.problem);
      setAnswer(saved.answer);
      setGrade(saved.grade);
      setRevealed(saved.revealed);
      setHint(saved.hint);
      setFollowUp(saved.followUp);
      setBusy(false);
      setError(null);
      setShowReminder(false);
      setHintBusy(false);
      setFollowUpBusy(false);
      setCopied(false);
      setConfidence(null);
      return;
    }
    const ctrl = new AbortController();
    generate(currentNode.id, ctrl.signal);
    return () => ctrl.abort();
  }, [index, generate, currentNode, done]);

  // Drop prefetch entries for nodes we've skipped past
  useEffect(() => {
    const keep = new Set([currentNode?.id, activeQueue[index + 1]?.id].filter(Boolean));
    for (const id of prefetchCache.current.keys()) {
      if (!keep.has(id)) prefetchCache.current.delete(id);
    }
  }, [index, currentNode, activeQueue]);

  // Prefetch next card while user is answering current — skip if already snapshotted
  useEffect(() => {
    if (!problem || done) return;
    const nextNode = activeQueue[index + 1];
    if (nextNode && !cardStatesRef.current[index + 1]?.problem) prefetch(nextNode.id);
  }, [problem, index, activeQueue, done, prefetch]);

  // Session elapsed timer — also drives exam countdown
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
      setSessionElapsed(elapsed);
      // Exam mode: auto-finish when time limit reached
      if (examMode && elapsed >= examMode.timeLimitSec) {
        setExamTimedOut(true);
        setDone(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [done, sessionStart, examMode]);

  // Fetch newly unlocked concepts when session completes
  useEffect(() => {
    if (!done) return;
    const masteredIds = Object.values(resultsByIndex)
      .filter((r) => r.justMastered)
      .map((r) => r.node.id);
    if (masteredIds.length === 0) return;
    fetch(`/api/newly-unlocked?nodes=${masteredIds.map(encodeURIComponent).join(",")}`)
      .then((r) => r.json())
      .then(setUnlockedNodes)
      .catch(() => {});
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to localStorage — include current card's live state
  useEffect(() => {
    if (done) {
      try { localStorage.removeItem(SESSION_KEY); } catch {}
      return;
    }
    try {
      const s: SavedSession = {
        activeQueue,
        index,
        preferKind,
        resultsByIndex,
        cardStates: {
          ...cardStatesRef.current,
          [index]: { problem, answer, grade, revealed, hint, followUp },
        },
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {}
  }, [activeQueue, index, preferKind, resultsByIndex, done, problem, answer, grade, revealed, hint, followUp]);

  // Keyboard navigation handler
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (done) return; // summary screen — let global shortcuts fire
      const inText = e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement;
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!grade && !busy && answer.trim()) submit();
        else if (grade && followUp.trim() && !followUpBusy) submitFollowUp();
        else if (grade) advance();
      } else if (!inText && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "ArrowLeft") goBack();
        else if (e.key === "ArrowRight" && grade) advance();
        else if (e.key === "h") {
          // Consume "h" entirely in-session so the global "Home" shortcut never fires.
          e.stopImmediatePropagation();
          if (!grade && !hint && problem?.mode !== "demo") getHint();
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // Snapshot current card before navigating away
  function saveCardState() {
    cardStatesRef.current[index] = { problem, answer, grade, revealed, hint, followUp };
  }

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
        setResultsByIndex((prev) => ({
          ...prev,
          [index]: { node: currentNode, verdict: "incorrect", masteryBefore: data.masteryBefore, masteryAfter: data.masteryAfter, elapsedSec },
        }));
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
      // Update this card's result specifically (not last item in array)
      setResultsByIndex((prev) => ({
        ...prev,
        [index]: {
          ...(prev[index] ?? { node: currentNode, masteryBefore: data.masteryBefore, elapsedSec: 0 }),
          verdict: data.verdict,
          masteryAfter: data.masteryAfter,
        },
      }));
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
        body: JSON.stringify({
          problemId: problem.problemId,
          answer,
          ...(enableCalibration && confidence !== null ? { predicted: confidence } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "grading failed");
      setGrade(data);
      const elapsedSec = Math.round((Date.now() - questionStart.current) / 1000);
      setResultsByIndex((prev) => ({
        ...prev,
        [index]: {
          node: currentNode,
          verdict: data.verdict,
          masteryBefore: data.masteryBefore,
          masteryAfter: data.masteryAfter,
          justMastered: data.justMastered ?? false,
          elapsedSec,
        },
      }));
    } catch (e: any) {
      setError(e.message || "Grading failed");
    } finally {
      setBusy(false);
    }
  }

  function advance() {
    saveCardState();
    if (index + 1 >= activeQueue.length) {
      setDone(true);
    } else {
      setIndex((i) => i + 1);
    }
  }

  function goBack() {
    if (index <= 0) return;
    saveCardState();
    setIndex((i) => i - 1);
  }

  function goTo(i: number) {
    if (i === index) return;
    saveCardState();
    setIndex(i);
  }

  // ─── Done screen ────────────────────────────────────────────────────────────
  if (done) {
    const results = Object.values(resultsByIndex);
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
    const areaMap = new Map<string, number>();
    for (const r of results) {
      if (r.node.area) areaMap.set(r.node.area, (areaMap.get(r.node.area) ?? 0) + 1);
    }

    return (
      <div className="session-summary">
        <div style={{ marginBottom: 6 }}>
          {examMode ? (
            <h2 style={{ color: examTimedOut ? "var(--amber)" : undefined }}>
              {examTimedOut ? "Time's up!" : isPerfect ? "Perfect exam!" : "Exam complete"}
            </h2>
          ) : (
            <h2>{isPerfect ? "Perfect session!" : "Session complete"}</h2>
          )}
          <p className="muted session-subtitle">
            {results.length} of {activeQueue.length} concept{activeQueue.length !== 1 ? "s" : ""} answered ·{" "}
            {Math.floor(sessionElapsed / 60)}m {sessionElapsed % 60}s
            {examMode && ` of ${examMode.timeLimitSec / 60}m`} ·{" "}
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

        {areaMap.size > 0 && (
          <p className="muted small summary-areas">
            {[...areaMap.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([area, count], i) => (
                <span key={area}>
                  {i > 0 && " · "}
                  <Link href={`/browse?area=${encodeURIComponent(area)}`}>{area}</Link>
                  {" "}<span className="summary-area-count">×{count}</span>
                </span>
              ))}
          </p>
        )}

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

        {unlockedNodes.length > 0 && (
          <div className="unlocked-banner">
            <div className="unlocked-banner-title">Concepts now available to learn</div>
            <div className="chips-row">
              {unlockedNodes.map((n) => (
                <Link key={n.id} href={`/node/${encodeURIComponent(n.id)}`} className="unlocked-node-chip">
                  {n.type && <span className={`type-badge t-${n.type}`}>{n.type}</span>}
                  {n.title}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="panel" style={{ marginTop: 24 }}>
          <h2>Results</h2>
          {Object.entries(resultsByIndex)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([qi, r]) => (
              <div key={qi} className="session-result-row">
                <span
                  className="verdict-dot icon-label"
                  style={{ background: VERDICT[r.verdict]?.bg, color: VERDICT[r.verdict]?.color }}
                >
                  <VerdictIcon verdict={r.verdict} size={11} />
                </span>
                <Link href={`/node/${encodeURIComponent(r.node.id)}`} className="text-link">
                  {r.node.title}
                </Link>
                {r.node.area && <span className="muted small"> · {r.node.area}</span>}
                {r.justMastered && <span className="mastered-badge">mastered</span>}
                <span className="muted small result-mastery icon-label">
                  {r.elapsedSec !== undefined && (
                    <span className="label-xs" style={{ opacity: 0.6 }}>{r.elapsedSec}s</span>
                  )}
                  {Math.round(r.masteryBefore * 100)}% <ArrowRight size={11} /> <strong>{Math.round(r.masteryAfter * 100)}%</strong>
                </span>
              </div>
            ))}
        </div>

        <div className="session-actions">
          {(incorrect + partial > 0) && (() => {
            const retryNodes = Object.values(resultsByIndex)
              .filter((r) => r.verdict === "incorrect" || r.verdict === "partial")
              .map((r) => r.node);
            return retryNodes.length > 0 ? (
              <button
                className="btn-ghost btn-sm btn-warn"
                onClick={() => {
                  setActiveQueue(retryNodes);
                  setResultsByIndex({});
                  cardStatesRef.current = {};
                  setIndex(0);
                  setDone(false);
                  setSessionElapsed(0);
                }}
              >
                Retry {incorrect + partial} missed
              </button>
            ) : null;
          })()}
          <Link href="/session" className="btn-primary">New session</Link>
          <Link href="/history" className="btn-ghost">History</Link>
          <Link href="/" className="btn-ghost">Home</Link>
        </div>
      </div>
    );
  }

  // ─── Active session ──────────────────────────────────────────────────────────
  return (
    <div className="practice">
      <div className="session-progress-header">
        <div className="session-progress-left">
          <button
            className="btn-ghost btn-sm icon-label"
            onClick={goBack}
            disabled={index === 0}
            title="Go back to previous concept"
          >
            <ArrowLeft size={13} /> Back
          </button>
          <span className="session-progress-ring" title={`${index} of ${activeQueue.length} concepts complete`}>
            <CircularProgress value={index / activeQueue.length} size={22} strokeWidth={2.5} />
            <span className="muted small">Concept {index + 1} of {activeQueue.length}</span>
          </span>
          {examMode ? (() => {
            const remaining = Math.max(0, examMode.timeLimitSec - sessionElapsed);
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            const warn = remaining < 5 * 60;
            return (
              <span
                className={`exam-timer tabular${warn ? " exam-timer-warn" : ""}`}
                title="Time remaining"
              >
                {mins}:{String(secs).padStart(2, "0")}
              </span>
            );
          })() : (
            <span className="muted small tabular">
              {Math.floor(sessionElapsed / 60)}:{String(sessionElapsed % 60).padStart(2, "0")}
            </span>
          )}
          {(() => {
            const vals = Object.values(resultsByIndex);
            if (vals.length === 0) return null;
            const c = vals.filter(r => r.verdict === "correct").length;
            const p = vals.filter(r => r.verdict === "partial").length;
            const w = vals.filter(r => r.verdict === "incorrect").length;
            return (
              <span className="session-live-score">
                {c > 0 && <span className="icon-label" style={{ color: "var(--green)" }}>{c}<Check size={11} /></span>}
                {p > 0 && <span style={{ color: "var(--amber)" }}>{p}~</span>}
                {w > 0 && <span className="icon-label" style={{ color: "var(--red)" }}>{w}<X size={11} /></span>}
              </span>
            );
          })()}
        </div>
        <div className="dots-row">
          {activeQueue.map((node, i) => (
            <span
              key={i}
              className={`progress-dot${i === index ? " dot-current" : ""}`}
              style={{
                background: resultsByIndex[i]
                  ? VERDICT[resultsByIndex[i].verdict]?.color
                  : i === index ? "var(--accent-strong)" : "var(--border)",
                cursor: i === index ? "default" : "pointer",
              }}
              title={node.title}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      </div>

      {busy && !problem && (
        <div className="panel problem-skeleton">
          <div className="skel skel-line" />
          <div className="skel skel-line" style={{ width: "92%" }} />
          <div className="skel skel-line" style={{ width: "86%" }} />
          <div className="skel skel-line" style={{ width: "55%" }} />
          <p className="muted small generating-label">
            <Spinner label="Generating a problem…" />
          </p>
        </div>
      )}
      {error && (
        <div className="panel error-notice">
          <div style={{ marginBottom: 8 }}>{error}</div>
          <div className="btn-row">
            <button className="btn-ghost btn-sm" onClick={() => generate(currentNode.id, undefined)} disabled={busy}>
              Retry
            </button>
            <button className="btn-ghost btn-sm" onClick={advance} disabled={busy}>
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
              <button className="btn-ghost btn-sm icon-label" onClick={advance} disabled={busy} style={{ marginTop: 10 }}>
                {index + 1 >= activeQueue.length ? "Finish session" : "Next concept"} <ArrowRight size={13} />
              </button>
            }
          />

          {!grade && !revealed && enableCalibration && (
            <ConfidenceSelect value={confidence} onChange={setConfidence} disabled={busy} />
          )}

          {!grade && !revealed && (
            <div className="practice-actions">
              <div className="practice-actions-group">
                <button className="btn-primary" onClick={submit} disabled={busy || !answer.trim()}>
                  {busy ? <Spinner label="Grading…" /> : "Submit"}
                </button>
                <VoiceInput
                  onTranscript={(t) => setAnswer((prev) => prev ? prev + " " + t : t)}
                  disabled={busy}
                />
              </div>
              <div className="practice-actions-group practice-actions-secondary">
                {problem.mode !== "demo" && !hint && (
                  <button
                    className="btn-ghost btn-sm btn-warn"
                    onClick={getHint}
                    disabled={busy || hintBusy}
                  >
                    {hintBusy ? "…" : "Hint"}
                  </button>
                )}
                <button className="btn-ghost btn-sm icon-label" onClick={advance} disabled={busy}>
                  Skip <ArrowRight size={12} />
                </button>
                <button className="btn-ghost btn-sm" onClick={reveal} disabled={busy} style={{ color: "var(--muted)" }}>
                  I don't know
                </button>
              </div>
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
                <button className="btn-primary icon-label" onClick={advance} disabled={busy}>
                  {index + 1 >= activeQueue.length ? "Finish session" : "Next concept"} <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

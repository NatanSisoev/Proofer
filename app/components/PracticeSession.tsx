"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Markdown from "./Markdown";
import VoiceInput from "./VoiceInput";
import { ProblemPanel, GradeFeedback, type Problem, type Grade } from "./ProblemCard";

export default function PracticeSession({ initialNodeId }: { initialNodeId?: string }) {
  const [problem, setProblem] = useState<Problem | null>(null);
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explanationBusy, setExplanationBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [hintBusy, setHintBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async (nodeId?: string, signal?: AbortSignal) => {
    setBusy(true);
    setError(null);
    setGrade(null);
    setAnswer("");
    setProblem(null);
    setRevealed(null);
    setElapsed(0);
    setTimerStart(null);
    setFollowUp("");
    setFollowUpBusy(false);
    setShowReminder(false);
    setExplanation(null);
    setExplanationBusy(false);
    setHint(null);
    setHintBusy(false);
    try {
      let id = nodeId;
      if (!id) {
        const r = await fetch("/api/practice/next", { signal }).then((r) => r.json());
        id = r.node?.id;
      }
      if (!id) {
        if (!signal?.aborted) setError("Nothing on your frontier to practice — mark some foundations known first.");
        return;
      }
      const res = await fetch("/api/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: id }),
        signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "generation failed");
      if (!signal?.aborted) {
        setProblem(data);
        setTimerStart(Date.now());
      }
    } catch (e: any) {
      if (e.name === "AbortError") return;
      if (!signal?.aborted) setError(e.message || "Something went wrong");
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    generate(initialNodeId, ctrl.signal);
    return () => ctrl.abort();
  }, [generate, initialNodeId]);

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
      if (res.ok) setRevealed(data.idealSolution);
    } finally {
      setBusy(false);
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
    } catch (e: any) {
      setError(e.message || "Grading failed");
    } finally {
      setBusy(false);
    }
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
      if (res.ok) setHint(data.hint || "");
      else setHint("Could not get a hint right now.");
    } catch { setHint("Could not get a hint right now."); }
    finally { setHintBusy(false); }
  }

  async function explain() {
    if (!problem || explanationBusy) return;
    setExplanationBusy(true);
    try {
      const res = await fetch(`/api/node/${encodeURIComponent(problem.node.id)}/explain`);
      const data = await res.json();
      if (res.ok) setExplanation(data.explanation || "");
    } catch { /* ignore */ }
    finally { setExplanationBusy(false); }
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
    } catch (e: any) {
      setError(e.message || "Grading failed");
    } finally {
      setFollowUpBusy(false);
    }
  }

  // Timer tick while problem is showing and not yet graded
  useEffect(() => {
    if (!timerStart || grade || revealed) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - timerStart) / 1000)), 1000);
    return () => clearInterval(id);
  }, [timerStart, grade, revealed]);

  // Ctrl+Enter to submit
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!grade && !busy && answer.trim() && problem) submit();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <div className="practice">
      {busy && !problem && <div className="panel muted">Generating a problem…</div>}
      {error && <div className="panel" style={{ color: "var(--red)" }}>{error}</div>}

      {problem && (
        <>
          <div className="practice-head">
            <div>
              <span className="muted small">Practicing</span>{" "}
              <Link href={`/node/${encodeURIComponent(problem.node.id)}`}>
                <strong>{problem.node.title}</strong>
              </Link>
              {problem.node.area && <span className="muted small"> · {problem.node.area}</span>}
              {problem.mode === "demo" && <span className="pill" style={{ marginLeft: 10 }}>demo mode — no API key</span>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {!grade && !revealed && elapsed > 0 && (
                <span className="muted small" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
                </span>
              )}
              <span className="pill">{problem.kind}</span>
            </div>
          </div>

          <ProblemPanel
            problem={problem}
            answer={answer}
            onAnswerChange={setAnswer}
            answerDisabled={!!grade || busy}
            answerPlaceholder="Write your answer — a proof, a definition, a counterexample. Type $...$ for math."
            copied={copied}
            onCopy={() => navigator.clipboard.writeText(problem.problem).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
            showConceptReminder={!grade && !revealed}
            reminderOpen={showReminder}
            onToggleReminder={() => setShowReminder((s) => !s)}
            reminderCaption="See the full note for details · this is just the overview."
            hint={!grade ? hint : null}
            onDismissHint={() => setHint(null)}
            revealed={revealed}
            revealedFooter={
              <button
                className="btn-ghost"
                onClick={() => generate(problem.node.id, undefined)}
                disabled={busy}
                style={{ marginTop: 10, fontSize: 13 }}
              >
                Try another on this concept →
              </button>
            }
          />

          {/* AI explanation panel */}
          {explanation && !grade && (
            <div className="panel" style={{ background: "var(--bg-soft)", marginTop: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h4 style={{ margin: 0, color: "var(--accent)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  AI Explanation
                </h4>
                <button className="btn-ghost" onClick={() => setExplanation(null)} style={{ fontSize: 12, padding: "2px 8px" }}>
                  ✕
                </button>
              </div>
              <div className="markdown"><Markdown>{explanation}</Markdown></div>
            </div>
          )}

          {!grade && !revealed && (
            <div className="practice-actions">
              <button className="btn-primary" onClick={submit} disabled={busy || !answer.trim()}>
                {busy ? "Grading…" : "Submit answer"}
              </button>
              <VoiceInput
                onTranscript={(t) => setAnswer((prev) => prev ? prev + " " + t : t)}
                disabled={busy}
              />
              <button className="btn-ghost" onClick={() => generate(problem.node.id, undefined)} disabled={busy}>
                Skip / new problem
              </button>
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
              {!explanation && problem.mode !== "demo" && (
                <button className="btn-ghost" onClick={explain} disabled={busy || explanationBusy} style={{ fontSize: 13 }}>
                  {explanationBusy ? "Explaining…" : "Explain first →"}
                </button>
              )}
              <button className="btn-ghost" onClick={reveal} disabled={busy} style={{ color: "var(--muted)", fontSize: 13 }}>
                I don't know
              </button>
              <span className="muted small" style={{ marginLeft: "auto", alignSelf: "center" }}>Ctrl+Enter</span>
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
                followUpPlaceholder="Show the missing step, fix the misconception, or complete the calculation…"
                followUpLeadText="Address the gap directly — no need to start over:"
                followUpMinHeight={100}
              />

              <div className="practice-actions" style={{ marginTop: grade.verdict !== "correct" ? 12 : 0 }}>
                <button className="btn-primary" onClick={() => generate(problem.node.id, undefined)} disabled={busy}>
                  {grade.verdict === "correct" ? "Another on this concept" : "Retry with hint →"}
                </button>
                {grade.blamed_prerequisite ? (
                  <button className="btn-ghost" onClick={() => generate(grade.blamed_prerequisite, undefined)} disabled={busy}>
                    Drill the prerequisite →
                  </button>
                ) : (
                  <button className="btn-ghost" onClick={() => generate(undefined, undefined)} disabled={busy}>
                    Next concept →
                  </button>
                )}
                {grade.verdict !== "correct" && (
                  <button className="btn-ghost" onClick={() => generate(undefined, undefined)} disabled={busy} style={{ fontSize: 13, color: "var(--muted)" }}>
                    I get it now, move on →
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

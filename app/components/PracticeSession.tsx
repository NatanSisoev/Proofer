"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Markdown from "./Markdown";
import VoiceInput from "./VoiceInput";
import AnswerBox from "./AnswerBox";

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

const VERDICT_STYLE: Record<string, { bg: string; label: string }> = {
  correct: { bg: "#173a2c", label: "Correct" },
  partial: { bg: "#3a341c", label: "Partially there" },
  incorrect: { bg: "#3a1c1c", label: "Not yet" },
};

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
      {error && <div className="panel" style={{ borderColor: "#5a2a2a", color: "#ff9b9b" }}>{error}</div>}

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

          <div className="panel">
            <Markdown>{problem.problem}</Markdown>
          </div>

          <AnswerBox
            value={answer}
            onChange={setAnswer}
            disabled={!!grade || busy}
            placeholder="Write your answer — a proof, a definition, a counterexample. Type $...$ for math."
          />

          {revealed && (
            <div className="panel" style={{ borderColor: "#2a3a2a", background: "#0d1a0d", marginTop: 4 }}>
              <h4 style={{ color: "var(--green)", margin: "0 0 8px" }}>Ideal solution</h4>
              <div className="markdown"><Markdown>{revealed}</Markdown></div>
              <button
                className="btn-ghost"
                onClick={() => generate(problem.node.id, undefined)}
                disabled={busy}
                style={{ marginTop: 10, fontSize: 13 }}
              >
                Try another on this concept →
              </button>
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

              {/* Follow-up reply — shown when answer was not fully correct */}
              {grade.verdict !== "correct" && (
                <div style={{ marginTop: 4, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                  <p className="muted small" style={{ margin: "0 0 8px" }}>
                    Address the gap directly — no need to start over:
                  </p>
                  <AnswerBox
                    value={followUp}
                    onChange={setFollowUp}
                    disabled={followUpBusy}
                    placeholder="Show the missing step, fix the misconception, or complete the calculation…"
                    style={{ minHeight: 100 }}
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

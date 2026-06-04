"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Markdown from "./Markdown";

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

  const generate = useCallback(async (nodeId?: string) => {
    setBusy(true);
    setError(null);
    setGrade(null);
    setAnswer("");
    setProblem(null);
    try {
      let id = nodeId;
      if (!id) {
        const r = await fetch("/api/practice/next").then((r) => r.json());
        id = r.node?.id;
      }
      if (!id) {
        setError("Nothing on your frontier to practice — mark some foundations known first.");
        return;
      }
      const res = await fetch("/api/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "generation failed");
      setProblem(data);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    generate(initialNodeId);
  }, [generate, initialNodeId]);

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
            <span className="pill">{problem.kind}</span>
          </div>

          <div className="panel">
            <Markdown>{problem.problem}</Markdown>
          </div>

          <textarea
            className="answer-box"
            placeholder="Write your answer — a proof, a definition, a counterexample, your reasoning. Don't look it up; produce it."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={!!grade || busy}
          />

          {!grade && (
            <div className="practice-actions">
              <button className="btn-primary" onClick={submit} disabled={busy || !answer.trim()}>
                {busy ? "Grading…" : "Submit answer"}
              </button>
              <button className="btn-ghost" onClick={() => generate(problem.node.id)} disabled={busy}>
                Skip / new problem
              </button>
            </div>
          )}

          {grade && (
            <div className="panel feedback">
              <div className="verdict" style={{ background: VERDICT_STYLE[grade.verdict]?.bg }}>
                {VERDICT_STYLE[grade.verdict]?.label || grade.verdict}
              </div>

              <div className="mastery-move">
                <span className="muted small">Mastery</span>
                <div className="bar"><span style={{ width: `${Math.round(grade.masteryAfter * 100)}%` }} /></div>
                <span className="small">
                  {Math.round(grade.masteryBefore * 100)}% → <strong>{Math.round(grade.masteryAfter * 100)}%</strong>
                </span>
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

              <div className="practice-actions">
                <button className="btn-primary" onClick={() => generate(problem.node.id)} disabled={busy}>
                  Another on this concept
                </button>
                {grade.blamed_prerequisite ? (
                  <button className="btn-ghost" onClick={() => generate(grade.blamed_prerequisite)} disabled={busy}>
                    Drill the prerequisite →
                  </button>
                ) : (
                  <button className="btn-ghost" onClick={() => generate()} disabled={busy}>
                    Next concept →
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

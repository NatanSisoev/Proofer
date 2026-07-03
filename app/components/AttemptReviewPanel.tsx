"use client";

import { useState } from "react";
import Link from "next/link";
import AnswerBox from "./AnswerBox";
import ErrorBanner from "./ErrorBanner";
import { GradeFeedback, type Grade } from "./ProblemCard";

/**
 * The interactive half of /attempt/[id] — lets a student reopen a past
 * problem, edit or rewrite their answer, resubmit it (a fresh attempt +
 * mastery update via the normal grading pipeline), and keep iterating
 * through GradeFeedback's built-in follow-up box exactly as in a live session.
 */
export default function AttemptReviewPanel({
  problemId,
  initialAnswer,
  nodeId,
}: {
  problemId: number | null;
  initialAnswer: string;
  nodeId: string;
}) {
  const [answer, setAnswer] = useState(initialAnswer);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [followUpBusy, setFollowUpBusy] = useState(false);

  if (!problemId) {
    return (
      <div className="panel muted small">
        This attempt predates the redo feature, so it can&rsquo;t be reopened for
        regrading — only viewed.{" "}
        <Link
          href={`/learn?node=${encodeURIComponent(nodeId)}`}
          className="pill pill-accent icon-label"
          style={{ marginLeft: 6 }}
        >
          Practice this concept fresh
        </Link>
      </div>
    );
  }

  async function submit() {
    if (!answer.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/practice/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId, answer }),
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
    if (!followUp.trim() || followUpBusy) return;
    setFollowUpBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/practice/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId, answer: followUp }),
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

  return (
    <>
      {!grade && (
        <div className="panel">
          <h2 style={{ marginBottom: 10 }}>Try again</h2>
          <AnswerBox
            value={answer}
            onChange={setAnswer}
            disabled={busy}
            placeholder="Edit your answer or write a fresh one — proof, definition, counterexample."
          />
          <div className="practice-actions" style={{ marginTop: 8 }}>
            <button className="btn-primary" onClick={submit} disabled={busy || !answer.trim()}>
              {busy ? "Grading…" : "Submit"}
            </button>
          </div>
          {error && <ErrorBanner>{error}</ErrorBanner>}
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
          />
          {error && <ErrorBanner>{error}</ErrorBanner>}
        </div>
      )}
    </>
  );
}

import Link from "next/link";
import Markdown from "./Markdown";
import AnswerBox from "./AnswerBox";
import VoiceInput from "./VoiceInput";
import { VERDICT } from "@/lib/verdict";

export type ProblemNode = { id: string; title: string; type: string | null; area: string | null };

export type Problem = {
  problemId: number;
  problem: string;
  kind: string;
  mode: "ai" | "demo";
  masteryBefore: number;
  node: ProblemNode;
};

export type Grade = {
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
  unlocked?: ProblemNode[];
};

/** The problem prompt, concept reminder, hint, answer box, and revealed solution. */
export function ProblemPanel({
  problem,
  answer,
  onAnswerChange,
  answerDisabled,
  answerPlaceholder,
  copied,
  onCopy,
  showConceptReminder,
  reminderOpen,
  onToggleReminder,
  reminderCaption,
  reminderLinkTarget,
  hint,
  onDismissHint,
  revealed,
  revealedFooter,
}: {
  problem: Problem;
  answer: string;
  onAnswerChange: (v: string) => void;
  answerDisabled: boolean;
  answerPlaceholder: string;
  copied: boolean;
  onCopy: () => void;
  showConceptReminder: boolean;
  reminderOpen: boolean;
  onToggleReminder: () => void;
  reminderCaption: string;
  reminderLinkTarget?: "_blank";
  hint: string | null;
  onDismissHint: () => void;
  revealed: string | null;
  revealedFooter?: React.ReactNode;
}) {
  return (
    <>
      <div className="panel" style={{ position: "relative" }}>
        <Markdown>{problem.problem}</Markdown>
        <button type="button" onClick={onCopy} title="Copy problem" className="copy-btn">
          {copied ? "✓" : "⎘"}
        </button>
      </div>

      {showConceptReminder && (
        <div>
          <button
            type="button"
            className="btn-ghost muted"
            onClick={onToggleReminder}
            style={{ fontSize: 12, marginBottom: reminderOpen ? 4 : 0 }}
          >
            {reminderOpen ? "Hide reminder ↑" : "Concept reminder ↓"}
          </button>
          {reminderOpen && (
            <div className="panel reminder-panel">
              <div className="reminder-header">
                {problem.node.type && <span className={`type-badge t-${problem.node.type}`}>{problem.node.type}</span>}
                <Link href={`/node/${encodeURIComponent(problem.node.id)}`} target={reminderLinkTarget} className="concept-link">
                  {problem.node.title}
                </Link>
                {problem.node.area && <span className="muted small">{problem.node.area}</span>}
              </div>
              <p className="muted small italic-note">
                {reminderCaption}
              </p>
            </div>
          )}
        </div>
      )}

      {hint && (
        <div className="panel hint-panel">
          <div className="panel-header" style={{ marginBottom: 6 }}>
            <h2 className="amber">Hint</h2>
            <button className="btn-ghost close-btn" onClick={onDismissHint}>
              ✕
            </button>
          </div>
          <div className="markdown" style={{ fontSize: 14 }}><Markdown>{hint}</Markdown></div>
        </div>
      )}

      <AnswerBox
        value={answer}
        onChange={onAnswerChange}
        disabled={answerDisabled}
        placeholder={answerPlaceholder}
        autoFocus
      />

      {revealed && (
        <div className="panel reveal-panel">
          <h4 className="reveal-heading">Ideal solution</h4>
          <div className="markdown"><Markdown>{revealed}</Markdown></div>
          {revealedFooter}
        </div>
      )}
    </>
  );
}

/** The graded-answer feedback: verdict, mastery move, what-you-got, the gap, hint, follow-up, and unlock celebration. */
export function GradeFeedback({
  grade,
  followUp,
  onFollowUpChange,
  followUpBusy,
  onSubmitFollowUp,
  followUpPlaceholder,
  followUpLeadText,
  followUpMinHeight = 100,
  unlockTarget,
}: {
  grade: Grade;
  followUp: string;
  onFollowUpChange: (v: string) => void;
  followUpBusy: boolean;
  onSubmitFollowUp: () => void;
  followUpPlaceholder: string;
  followUpLeadText: string;
  followUpMinHeight?: number;
  unlockTarget?: "_blank";
}) {
  return (
    <>
      <div className={`verdict${grade.verdict === "correct" ? " verdict-correct" : ""}`} style={{ background: VERDICT[grade.verdict]?.bg }}>
        {VERDICT[grade.verdict]?.label || grade.verdict}
      </div>

      <div className="mastery-move">
        <span className="muted small">Mastery</span>
        <div className="bar"><span style={{ width: `${Math.round(grade.masteryAfter * 100)}%` }} /></div>
        <span className="small">
          {Math.round(grade.masteryBefore * 100)}% → <strong>{Math.round(grade.masteryAfter * 100)}%</strong>
        </span>
        {grade.halfLife && (
          <span className="muted small review-hint">
            review in ~{grade.halfLife}d
          </span>
        )}
      </div>

      {grade.understood?.length > 0 && (
        <div className="fb-block">
          <h4 className="green">What you got</h4>
          <ul>{grade.understood.map((u, i) => <li key={i}>{u}</li>)}</ul>
        </div>
      )}

      <div className="fb-block">
        <h4 className="amber">The gap</h4>
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
        <h4 className="accent">Hint (not the answer)</h4>
        <div className="markdown"><Markdown>{grade.socratic_hint}</Markdown></div>
      </div>

      {grade.verdict !== "correct" && (
        <div className="follow-up-section">
          <p className="muted small" style={{ margin: "0 0 8px" }}>
            {followUpLeadText}
          </p>
          <AnswerBox
            value={followUp}
            onChange={onFollowUpChange}
            disabled={followUpBusy}
            placeholder={followUpPlaceholder}
            style={{ minHeight: followUpMinHeight }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                e.nativeEvent.stopPropagation();
                if (followUp.trim()) onSubmitFollowUp();
              }
            }}
          />
          <div className="practice-actions" style={{ marginTop: 8 }}>
            <button className="btn-primary" onClick={onSubmitFollowUp} disabled={followUpBusy || !followUp.trim()}>
              {followUpBusy ? "Checking…" : "Submit follow-up"}
            </button>
            <VoiceInput onTranscript={(t) => onFollowUpChange(followUp ? followUp + " " + t : t)} disabled={followUpBusy} />
            <span className="muted small keyboard-hint">Ctrl+Enter</span>
          </div>
        </div>
      )}

      {grade.justMastered && grade.unlocked && grade.unlocked.length > 0 && (
        <div className="mastered-banner" style={{ marginTop: 4 }}>
          <div className="mastered-banner-title">
            Mastered! You just unlocked {grade.unlocked.length} new concept{grade.unlocked.length !== 1 ? "s" : ""}
          </div>
          <div className="chips-row">
            {grade.unlocked.map((n) => (
              <Link key={n.id} href={`/node/${encodeURIComponent(n.id)}`} target={unlockTarget} className="mastered-node-chip">
                {n.type && <span className="label-xs" style={{ opacity: 0.7 }}>{n.type}</span>}
                {n.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

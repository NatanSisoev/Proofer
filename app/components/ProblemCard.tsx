import Link from "next/link";
import Markdown from "./Markdown";
import MathText from "./MathText";
import AnswerBox from "./AnswerBox";
import VoiceInput from "./VoiceInput";
import { VERDICT } from "@/lib/verdict";
import { Check, Copy, ChevronUp, ChevronDown, X, ArrowRight } from "./Icons";

export type ProblemNode = { id: string; title: string; type: string | null; area: string | null };

export type Problem = {
  problemId: number;
  problem: string;
  kind: string;
  mode: "ai" | "demo";
  masteryBefore: number;
  node: ProblemNode;
};

export type RubricPointResult = { point: string; met: boolean; note: string };

export type Grade = {
  verdict: "correct" | "partial" | "incorrect";
  mastery_evidence: number;
  rubric_points: RubricPointResult[];
  understood: string[];
  gap: string;
  blamed_prerequisite: string;
  socratic_hint: string;
  masteryBefore: number;
  masteryAfter: number;
  halfLife?: number;
  justMastered?: boolean;
  unlocked?: ProblemNode[];
  trust?: "model-judged" | "cross-checked" | "refuted";
  refutation?: string; // set when an adversarial second pass found a hole in an initially "correct" verdict
};

// Pre-answer confidence options. The values are the probability the student is
// asserting they'll be graded correct — fed to the grader as `predicted` and
// scored against the realized verdict (Brier score) on the Progress page.
export const CONFIDENCE_OPTIONS: { label: string; value: number; hint: string }[] = [
  { label: "Guessing", value: 0.2, hint: "Little idea — taking a shot" },
  { label: "Unsure", value: 0.5, hint: "Could go either way" },
  { label: "Confident", value: 0.85, hint: "I've got this" },
];

/** A one-tap self-rating of confidence, shown before the answer is submitted. */
export function ConfidenceSelect({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="confidence-select">
      <span className="muted small">How sure are you? <span style={{ color: "var(--accent)" }}>*</span></span>
      <div className="confidence-options">
        {CONFIDENCE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            title={o.hint}
            className={`confidence-chip${value === o.value ? " confidence-chip-active" : ""}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>

      {showConceptReminder && (
        <div>
          <button
            type="button"
            className="btn-ghost muted icon-label"
            onClick={onToggleReminder}
            style={{ fontSize: 12, marginBottom: reminderOpen ? 4 : 0 }}
          >
            {reminderOpen ? <>Hide reminder <ChevronUp size={12} /></> : <>Concept reminder <ChevronDown size={12} /></>}
          </button>
          {reminderOpen && (
            <div className="panel reminder-panel">
              <div className="reminder-header">
                {problem.node.type && <span className={`type-badge t-${problem.node.type}`}>{problem.node.type}</span>}
                <Link href={`/node/${encodeURIComponent(problem.node.id)}`} target={reminderLinkTarget} className="concept-link">
                  <MathText>{problem.node.title}</MathText>
                </Link>
                {problem.node.area && <span className="muted small"><MathText>{problem.node.area}</MathText></span>}
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
              <X size={13} />
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
        <span className="small icon-label">
          {Math.round(grade.masteryBefore * 100)}% <ArrowRight size={11} /> <strong>{Math.round(grade.masteryAfter * 100)}%</strong>
        </span>
        {grade.halfLife && (
          <span className="muted small review-hint">
            review in ~{grade.halfLife}d
          </span>
        )}
      </div>

      {grade.rubric_points?.length > 0 && (
        <div className="fb-block">
          <h4>Rubric</h4>
          <ul className="rubric-checklist">
            {grade.rubric_points.map((p, i) => (
              <li key={i} className={p.met ? "rubric-point-met" : "rubric-point-unmet"}>
                {p.met ? <Check size={13} /> : <X size={13} />}
                <div>
                  <MathText>{p.point}</MathText>
                  {p.note && <div className="muted small rubric-note"><MathText>{p.note}</MathText></div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {grade.refutation && (
        <div className="fb-block">
          <h4 className="red">Second look</h4>
          <p className="muted small" style={{ margin: "0 0 8px" }}>
            Every rubric point checked out, but a rigorous second pass found a hole:
          </p>
          <div className="markdown"><Markdown>{grade.refutation}</Markdown></div>
        </div>
      )}

      {grade.gap && (
        <div className="fb-block">
          <h4 className="amber">The gap</h4>
          <div className="markdown"><Markdown>{grade.gap}</Markdown></div>
          {grade.blamed_prerequisite && (
            <p className="small" style={{ marginTop: 8 }}>
              This traces back to{" "}
              <Link href={`/learn?node=${encodeURIComponent(grade.blamed_prerequisite)}`}>
                <strong><MathText>{grade.blamed_prerequisite}</MathText></strong>
              </Link>{" "}
              — practice that first.
            </p>
          )}
        </div>
      )}

      <div className="fb-block">
        <h4 className="purple">Hint (not the answer)</h4>
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
                <MathText>{n.title}</MathText>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

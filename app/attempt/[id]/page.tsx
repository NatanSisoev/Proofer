import Link from "next/link";
import { notFound } from "next/navigation";
import { getAttempt } from "@/lib/queries";
import Markdown from "@/app/components/Markdown";
import MathText from "@/app/components/MathText";
import TrustBadge from "@/app/components/TrustBadge";
import AttemptReviewPanel from "@/app/components/AttemptReviewPanel";
import { VERDICT, type Verdict } from "@/lib/verdict";
import { ArrowLeft } from "@/app/components/Icons";

export const dynamic = "force-dynamic";

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const attemptId = Number(id);
  if (!Number.isInteger(attemptId)) notFound();

  const attempt = getAttempt(attemptId);
  if (!attempt) notFound();

  const verdictStyle = VERDICT[attempt.verdict as Verdict];
  const showGap =
    attempt.gap && attempt.gap !== "none" && attempt.gap !== "(gave up — showed answer)";

  return (
    <div className="wrap wrap-narrow">
      <div className="page-top" style={{ marginBottom: 20 }}>
        <div>
          <h1>Review attempt</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            {attempt.node_title ? (
              <Link href={`/node/${encodeURIComponent(attempt.node_id)}`}>
                <MathText>{attempt.node_title}</MathText>
              </Link>
            ) : (
              attempt.node_id
            )}
            {attempt.node_area && <> · {attempt.node_area}</>}
          </p>
        </div>
        <Link href="/history" className="muted small icon-label">
          <ArrowLeft size={12} /> history
        </Link>
      </div>

      <div className="panel-stack">
        <div className="panel">
          <div className="verdict-row" style={{ marginBottom: 14 }}>
            <div className="verdict" style={{ background: verdictStyle?.bg, color: verdictStyle?.color }}>
              {verdictStyle?.label || attempt.verdict}
            </div>
            <TrustBadge trust={attempt.trust} />
            {attempt.kind && <span className="pill label-xs">{attempt.kind}</span>}
            <span className="muted small">{new Date(attempt.created_at).toLocaleString()}</span>
          </div>

          <h2 className="label-xs muted" style={{ marginBottom: 6 }}>Problem</h2>
          <div className="markdown"><Markdown>{attempt.problem}</Markdown></div>
        </div>

        <div className="panel">
          <h2 className="label-xs muted" style={{ marginBottom: 6 }}>Your answer (at the time)</h2>
          {attempt.answer ? (
            <div className="markdown"><Markdown>{attempt.answer}</Markdown></div>
          ) : (
            <p className="muted small">(no answer recorded)</p>
          )}
        </div>

        {showGap && (
          <div className="panel">
            <h4 className="amber">The gap</h4>
            <div className="markdown"><Markdown>{attempt.gap!}</Markdown></div>
            {attempt.blamed_prereq && (
              <p className="small" style={{ marginTop: 8 }}>
                This traces back to{" "}
                <Link href={`/learn?node=${encodeURIComponent(attempt.blamed_prereq)}`}>
                  <strong><MathText>{attempt.blamed_prereq}</MathText></strong>
                </Link>{" "}
                — practice that first.
              </p>
            )}
          </div>
        )}

        <AttemptReviewPanel
          problemId={attempt.problem_id}
          initialAnswer={attempt.answer || ""}
          nodeId={attempt.node_id}
        />
      </div>
    </div>
  );
}

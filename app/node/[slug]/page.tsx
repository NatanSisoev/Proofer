import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "@/app/components/Markdown";
import EgoGraph from "@/app/components/EgoGraph";
import KnownButton from "@/app/components/KnownButton";
import NodeActions from "@/app/components/NodeActions";
import LearningPath from "@/app/components/LearningPath";
import WeaknessDiagnosis from "@/app/components/WeaknessDiagnosis";
import BookmarkButton from "@/app/components/BookmarkButton";
import GhostCreate from "@/app/components/GhostCreate";
import MathText from "@/app/components/MathText";
import MasterySparkline from "@/app/components/MasterySparkline";
import PersonalNotes from "@/app/components/PersonalNotes";
import ReExplain from "@/app/components/ReExplain";
import CompareWith from "@/app/components/CompareWith";
import ReadingProgress from "@/app/components/ReadingProgress";
import { getNode, edgesOf, isKnown, readiness, prerequisites, attemptCount, isBookmarked, nodeAttempts, nodeAttemptDetails, nextReviewDays, similarConcepts } from "@/lib/queries";
import { truncateMath } from "@/lib/text";
import { getMasteryP } from "@/lib/mastery";
import { HAS_KEY } from "@/lib/llm";
import type { EdgeRow } from "@/lib/db";

export const dynamic = "force-dynamic";

const EDGE_LABEL: Record<string, string> = {
  depends_on: "depends on",
  generalizes: "generalizes",
  equivalent_to: "equivalent to",
  instance_of: "instance of",
  contradicts: "contradicts",
  related: "related to",
};
const INV_LABEL: Record<string, string> = {
  depends_on: "required for",
  generalizes: "specializes",
  equivalent_to: "equivalent to",
  instance_of: "has instance",
  contradicts: "contradicted by",
  related: "related to",
};

function RelList({ rows, dir }: { rows: EdgeRow[]; dir: "out" | "in" }) {
  if (rows.length === 0) return <p className="muted small">None.</p>;
  return (
    <ul className="rel-list">
      {rows.map((e, i) => {
        const other = dir === "out" ? e.dst : e.src;
        const label = dir === "out" ? EDGE_LABEL[e.type] : INV_LABEL[e.type];
        return (
          <li key={i}>
            <span className={`edge-type ${e.type}`}>{label}</span>
            <Link href={`/node/${encodeURIComponent(other)}`}>{other}</Link>
            {e.context && <MathText className="edge-ctx">{"— " + e.context.replace(/\*\*/g, "")}</MathText>}
          </li>
        );
      })}
    </ul>
  );
}

export default async function NodePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = decodeURIComponent(slug);
  const node = getNode(id);
  if (!node) notFound();

  const { outgoing, incoming } = edgesOf(id);
  const known = isKnown(id);
  const mastery = getMasteryP(id);
  const ready = readiness(id);
  const { depth } = prerequisites(id);
  const attempts = attemptCount(id);
  const bookmarked = isBookmarked(id);
  const history = nodeAttempts(id, 10);
  const attemptDetails = nodeAttemptDetails(id, 6);
  const reviewDays = nextReviewDays(id);
  const similar = node.area ? similarConcepts(id, node.area, mastery, 6) : [];

  // group outgoing by semantic priority
  const order = ["depends_on", "generalizes", "equivalent_to", "instance_of", "contradicts", "related"];
  const sortByType = (a: EdgeRow, b: EdgeRow) => order.indexOf(a.type) - order.indexOf(b.type);
  outgoing.sort(sortByType);
  incoming.sort(sortByType);

  return (
    <div className="wrap">
      <ReadingProgress />
      <div className="breadcrumb">
        <Link href="/">← map</Link>
        {node.area && (
          <> · <Link href={`/browse?area=${encodeURIComponent(node.area)}`}>{node.area}</Link></>
        )}
      </div>

      {node.exists_ === 0 ? (
        <>
          <div className="node-head">
            <div>
              <span className="type-badge t-ghost">gap</span>
              <h1>{node.title}</h1>
            </div>
            <GhostCreate nodeId={id} nodeTitle={node.title} nodeArea={node.area} />
          </div>
          <p className="muted">
            This concept is referenced by other notes but doesn&apos;t have a note yet — a gap in your graph.
            {incoming.length > 0 && ` ${incoming.length} concept(s) depend on it.`}
          </p>
          <div className="panel" style={{ marginTop: 20 }}>
            <h2>Referenced by</h2>
            <RelList rows={incoming} dir="in" />
          </div>
        </>
      ) : (
        <>
          <div className="node-head">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {node.type && <span className={`type-badge t-${node.type}`}>{node.type}</span>}
                {node.area && <span className="muted small">{node.area}</span>}
                {depth > 0 && (
                  <span className="pill" style={{ fontSize: 10 }}>
                    depth {depth}
                  </span>
                )}
                {mastery >= 0.8 && (
                  <span className="mastered-badge">mastered</span>
                )}
                {attempts > 0 && (
                  <span className="muted small">{attempts} attempt{attempts !== 1 ? "s" : ""}</span>
                )}
              </div>
              <h1>{node.title}</h1>
              {node.overview && (
                <MathText className="muted" style={{ display: "block", marginTop: -2, maxWidth: 640, lineHeight: 1.5 }}>
                  {node.overview}
                </MathText>
              )}
              <div className="mastery-chip">
                <span className="muted small">mastery</span>
                <div className="bar" style={{ width: 120 }}><span style={{ width: `${Math.round(mastery * 100)}%` }} /></div>
                <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em" }}>{Math.round(mastery * 100)}%</span>
                <MasterySparkline nodeId={id} />
                {reviewDays !== null && (
                  <span
                    className="pill"
                    style={{
                      fontSize: 10,
                      color: reviewDays < 0 ? "var(--amber)" : reviewDays === 0 ? "var(--amber)" : "var(--muted)",
                    }}
                  >
                    {reviewDays < 0
                      ? `review overdue ${Math.abs(reviewDays)}d`
                      : reviewDays === 0
                      ? "review today"
                      : `review in ${reviewDays}d`}
                  </span>
                )}
                {history.length > 0 && (
                  <div style={{ display: "flex", gap: 4, alignItems: "center", marginLeft: 4 }}>
                    {history.slice().reverse().map((a, i) => (
                      <span
                        key={i}
                        title={`${a.verdict} · ${a.kind}`}
                        className="verdict-dot-sm"
                        style={{
                          background: a.verdict === "correct" ? "var(--green)" : a.verdict === "partial" ? "var(--amber)" : "var(--red)",
                          opacity: 0.6 + i / history.length * 0.4,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              {HAS_KEY && <WeaknessDiagnosis nodeId={id} attemptCount={attempts} />}
            </div>
            <div className="node-side-col">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Link href={`/learn?node=${encodeURIComponent(id)}`} className="cta">Practice this →</Link>
                <BookmarkButton nodeId={id} initial={bookmarked} />
              </div>
              {node.area && (
                <Link
                  href={`/session?mode=area&area=${encodeURIComponent(node.area)}`}
                  className="pill"
                  style={{ color: "var(--accent)", borderColor: "var(--accent-soft)" }}
                >
                  Session: {node.area}
                </Link>
              )}
              <KnownButton slug={id} initial={known} />
              <NodeActions nodeId={id} nodePath={node.path ?? null} hasLLM={HAS_KEY} />
            </div>
          </div>

          {ready.total > 0 && (
            <div className="readiness panel">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <strong>Readiness {Math.round(ready.score * 100)}%</strong>
                <span className="muted small">
                  {ready.known}/{ready.total} prerequisites known · dependency depth {depth}
                </span>
              </div>
              <div className="bar"><span style={{ width: `${Math.round(ready.score * 100)}%` }} /></div>
              {ready.missing.length > 0 && (
                <p className="muted small" style={{ marginTop: 10 }}>
                  Still need:{" "}
                  {ready.missing.slice(0, 8).map((m, i) => (
                    <span key={m.id}>
                      {i > 0 && ", "}
                      <Link href={`/node/${encodeURIComponent(m.id)}`}>{m.title}</Link>
                    </span>
                  ))}
                  {ready.missing.length > 8 && ` and ${ready.missing.length - 8} more`}
                </p>
              )}
            </div>
          )}

          <LearningPath nodeId={id} />

          <div className="grid" style={{ marginTop: 20 }}>
            <div>
              {node.content && (
                <>
                  {(() => {
                    const words = node.content!.split(/\s+/).length;
                    const mins = Math.max(1, Math.round(words / 200));
                    return (
                      <p className="muted small" style={{ marginTop: 0, marginBottom: 12 }}>
                        ~{mins} min read · {words} words
                      </p>
                    );
                  })()}
                  <Markdown>{node.content}</Markdown>
                </>
              )}
              <PersonalNotes nodeId={id} />
              {HAS_KEY && <ReExplain nodeId={id} />}
              {HAS_KEY && <CompareWith nodeId={id} nodeTitle={node.title} />}

              {/* Past practice problems */}
              {attemptDetails.length > 0 && (
                <details className="practice-history">
                  <summary>
                    <span>Past practice</span>
                    <span style={{ fontWeight: 400 }}>({attemptDetails.length} attempt{attemptDetails.length !== 1 ? "s" : ""})</span>
                  </summary>
                  <div className="attempt-list">
                    {attemptDetails.map((a) => {
                      const verdictColor = a.verdict === "correct" ? "var(--green)" : a.verdict === "partial" ? "var(--amber)" : "var(--red)";
                      const verdictLabel = a.verdict === "correct" ? "correct" : a.verdict === "partial" ? "partial" : "incorrect";
                      return (
                        <div key={a.id} className="practice-attempt">
                          <div className="attempt-header">
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontWeight: 600, color: verdictColor, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>{verdictLabel}</span>
                              {a.kind && <span className="pill" style={{ fontSize: 10 }}>{a.kind}</span>}
                            </div>
                            <span className="muted small">{new Date(a.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="attempt-problem">
                            <MathText>{truncateMath(a.problem, 200)}</MathText>
                          </p>
                          {a.gap && a.gap !== "none" && a.gap !== "(gave up — showed answer)" && (
                            <p className="muted small" style={{ margin: 0, fontStyle: "italic" }}>
                              Gap: <MathText>{truncateMath(a.gap, 120)}</MathText>
                            </p>
                          )}
                        </div>
                      );
                    })}
                    <Link href={`/learn?node=${encodeURIComponent(id)}`} className="btn-ghost" style={{ fontSize: 13, alignSelf: "flex-start" }}>
                      Practice again →
                    </Link>
                  </div>
                </details>
              )}
            </div>
            <div>
              <div className="panel" style={{ marginBottom: 16 }}>
                <h2>Neighborhood</h2>
                <EgoGraph slug={id} depth={1} />
              </div>
              <div className="panel" style={{ marginBottom: 16 }}>
                <h2>Outgoing</h2>
                <RelList rows={outgoing} dir="out" />
              </div>
              <div className="panel">
                <h2>Incoming</h2>
                <RelList rows={incoming} dir="in" />
              </div>
              {similar.length > 0 && (
                <div className="panel">
                  <h2>Also in {node.area}</h2>
                  {similar.map((s) => (
                    <div key={s.id} className="frontier-item">
                      <div style={{ minWidth: 0 }}>
                        {s.type && <span className={`type-badge t-${s.type}`} style={{ marginRight: 6 }}>{s.type}</span>}
                        <Link href={`/node/${encodeURIComponent(s.id)}`} style={{ fontSize: 13.5, color: "var(--text)" }}>
                          {s.title}
                        </Link>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <div className="bar" style={{ width: 40 }}>
                          <span style={{ width: `${Math.round(s.mastery_p * 100)}%` }} />
                        </div>
                        <span className="muted small" style={{ fontSize: 11, width: 28, textAlign: "right" }}>
                          {Math.round(s.mastery_p * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                  <Link
                    href={`/browse?area=${encodeURIComponent(node.area!)}`}
                    className="muted small"
                    style={{ display: "block", marginTop: 8, fontSize: 11 }}
                  >
                    Browse all {node.area} →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

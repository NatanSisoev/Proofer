import Link from "next/link";
import nextDynamic from "next/dynamic";
import { notFound } from "next/navigation";
import Markdown from "@/app/components/Markdown";
import KnownButton from "@/app/components/KnownButton";
import NodeActions from "@/app/components/NodeActions";
import LearningPath from "@/app/components/LearningPath";
import WeaknessDiagnosis from "@/app/components/WeaknessDiagnosis";
import BookmarkButton from "@/app/components/BookmarkButton";
import GhostCreate from "@/app/components/GhostCreate";
import MathText from "@/app/components/MathText";
import MasterySparkline from "@/app/components/MasterySparkline";
import MasteryRing from "@/app/components/MasteryRing";
import PersonalNotes from "@/app/components/PersonalNotes";
import ReExplain from "@/app/components/ReExplain";
import CompareWith from "@/app/components/CompareWith";
import ReadingProgress from "@/app/components/ReadingProgress";
import GoalButton from "@/app/components/GoalButton";
import NodePanels, { NodePanel } from "@/app/components/NodePanels";
import { getNode, edgesOf, isKnown, readiness, prerequisites, attemptCount, isBookmarked, nodeAttempts, nodeAttemptDetails, nextReviewDays, similarConcepts, nodeBlamedPrereqs, egoGraph, prerequisiteGraph } from "@/lib/queries";
import { truncateMath } from "@/lib/text";
import { getMasteryP } from "@/lib/mastery";
import { hasKey } from "@/lib/llm";
import { getLearningGoal } from "@/lib/settings";
import { ArrowLeft, ArrowRight } from "@/app/components/Icons";
import { MASTERY_THRESHOLD, type EdgeRow } from "@/lib/db";

// cytoscape is a heavy client-only lib; defer it to its own chunk so it
// doesn't bloat the JS every node navigation has to download and parse.
const EgoGraph = nextDynamic(() => import("@/app/components/EgoGraph"), {
  loading: () => <div className="graph-shell graph-shell-loading" />,
});
const PrereqGraph = nextDynamic(() => import("@/app/components/PrereqGraph"), {
  loading: () => <div className="graph-shell graph-shell-loading" />,
});

export const dynamic = "force-dynamic";

const EDGE_LABEL: Record<string, string> = {
  depends_on: "depends on",
  generalizes: "generalizes",
  equivalent_to: "equivalent to",
  instance_of: "instance of",
  proven_by: "proven by",
  contradicts: "contradicts",
  related: "related to",
};
const INV_LABEL: Record<string, string> = {
  depends_on: "required for",
  generalizes: "specializes",
  equivalent_to: "equivalent to",
  instance_of: "has instance",
  proven_by: "proves",
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
            <Link href={`/node/${encodeURIComponent(other)}`}><MathText>{other}</MathText></Link>
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
  const llmAvailable = hasKey();

  const { outgoing, incoming } = edgesOf(id);
  const known = isKnown(id);
  const mastery = getMasteryP(id);
  const { closure, depth } = prerequisites(id);
  const ready = readiness(id, closure);
  const attempts = attemptCount(id);
  const bookmarked = isBookmarked(id);
  const history = nodeAttempts(id, 10);
  const attemptDetails = nodeAttemptDetails(id, 6);
  const reviewDays = nextReviewDays(id);
  const similar = node.area ? similarConcepts(id, node.area, mastery, 6) : [];
  const blamedPrereqs = attempts >= 2 ? nodeBlamedPrereqs(id, 3) : [];
  const ego = node.exists_ === 1 ? egoGraph(id, 1) : null;
  const prereqG = node.exists_ === 1 ? prerequisiteGraph(id) : null;
  const hasPrereqGraph = !!prereqG && prereqG.nodes.length > 1 && prereqG.edges.length > 0;
  const currentGoal = getLearningGoal();

  // Most recent non-correct attempt gap — surfaced prominently near the CTA
  const lastGapAttempt = attemptDetails.find(
    (a) => a.verdict !== "correct" && a.gap && a.gap !== "none" && a.gap !== "(gave up — showed answer)"
  ) ?? null;

  // group outgoing by semantic priority
  const order = ["depends_on", "generalizes", "equivalent_to", "instance_of", "contradicts", "related"];
  const sortByType = (a: EdgeRow, b: EdgeRow) => order.indexOf(a.type) - order.indexOf(b.type);
  outgoing.sort(sortByType);
  incoming.sort(sortByType);

  const count = (n: number) => <span className="node-accordion-count">{n}</span>;

  return (
    <div className="wrap">
      <ReadingProgress />
      <div className="breadcrumb">
        <Link href="/explore?view=sections" className="icon-label"><ArrowLeft size={12} /> browse</Link>
        {node.area && (
          <> · <Link href={`/explore?view=sections&area=${encodeURIComponent(node.area)}`}>{node.area}</Link></>
        )}
      </div>

      {node.exists_ === 0 ? (
        <>
          <div className="node-head">
            <div>
              <span className="type-badge t-ghost">gap</span>
              <h1><MathText>{node.title}</MathText></h1>
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
              <div className="node-meta-row">
                {node.type && <span className={`type-badge t-${node.type}`}>{node.type}</span>}
                {node.area && <span className="muted small">{node.area}</span>}
                {depth > 0 && (
                  <span className="pill label-xs">
                    depth {depth}
                  </span>
                )}
                {mastery >= MASTERY_THRESHOLD && (
                  <span className="mastered-badge">mastered</span>
                )}
                {attempts > 0 && (
                  <span className="muted small">{attempts} attempt{attempts !== 1 ? "s" : ""}</span>
                )}
              </div>
              <h1><MathText>{node.title}</MathText></h1>
              {node.overview && (
                <MathText className="muted node-overview">
                  {node.overview}
                </MathText>
              )}
              <div className="mastery-chip">
                <MasteryRing p={mastery} size={46} />
                <span className="muted small">mastery</span>
                <MasterySparkline nodeId={id} />
                {reviewDays !== null && (
                  <span
                    className="pill label-xs"
                    style={{ color: reviewDays < 0 ? "var(--amber)" : reviewDays === 0 ? "var(--amber)" : "var(--muted)" }}
                  >
                    {reviewDays < 0
                      ? `review overdue ${Math.abs(reviewDays)}d`
                      : reviewDays === 0
                      ? "review today"
                      : `review in ${reviewDays}d`}
                  </span>
                )}
                {history.length > 0 && (
                  <div className="history-dots">
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
              {llmAvailable && <WeaknessDiagnosis nodeId={id} attemptCount={attempts} />}
              {blamedPrereqs.length > 0 && (
                <div className="blamed-prereqs">
                  <span className="muted small">Grader blamed: </span>
                  {blamedPrereqs.map((b) => (
                    <span key={b.prereq} className="blamed-prereq-chip">
                      {b.exists_ ? (
                        <Link href={`/node/${encodeURIComponent(b.prereq)}`} className="blamed-prereq-link">
                          <MathText>{b.prereq}</MathText>
                        </Link>
                      ) : (
                        <span className="muted"><MathText>{b.prereq}</MathText></span>
                      )}
                      {b.blame_count > 1 && (
                        <span className="blame-count">×{b.blame_count}</span>
                      )}
                    </span>
                  ))}
                  {blamedPrereqs.some((b) => b.exists_) && (
                    <Link
                      href={`/session?mode=custom&nodes=${blamedPrereqs.filter((b) => b.exists_).slice(0, 5).map((b) => encodeURIComponent(b.prereq)).join(",")}`}
                      className="pill pill-accent pill-xs icon-label"
                      style={{ marginLeft: 6 }}
                    >
                      Practice gaps <ArrowRight size={10} />
                    </Link>
                  )}
                </div>
              )}
            </div>
            <div className="node-side-col">
              <Link href={`/learn?node=${encodeURIComponent(id)}`} className="cta icon-label btn-full">Practice this <ArrowRight size={13} /></Link>
              <div className="node-action-row">
                <BookmarkButton nodeId={id} initial={bookmarked} />
                <GoalButton nodeId={id} isCurrentGoal={currentGoal === id} />
                <KnownButton slug={id} initial={known} />
              </div>
              {node.area && (
                <Link
                  href={`/session?mode=area&area=${encodeURIComponent(node.area)}`}
                  className="btn-ghost btn-sm icon-label"
                >
                  Practice {node.area} <ArrowRight size={12} />
                </Link>
              )}
              {lastGapAttempt && (
                <div className="last-gap-note">
                  <span className="muted small last-gap-label">Last gap identified:</span>
                  <MathText className="small last-gap-text">{lastGapAttempt.gap!.length > 140 ? lastGapAttempt.gap!.slice(0, 140) + "…" : lastGapAttempt.gap!}</MathText>
                </div>
              )}
            </div>
          </div>

          {ready.total > 0 && (
            <div className="readiness panel">
              <div className="readiness-header">
                <strong>Readiness {Math.round(ready.score * 100)}%</strong>
                <span className="muted small">
                  {ready.known}/{ready.total} prerequisites known · dependency depth {depth}
                </span>
              </div>
              <div className="bar"><span style={{ width: `${Math.round(ready.score * 100)}%` }} /></div>
              {ready.missing.length > 0 && (
                <div className="readiness-missing">
                  <p className="muted small" style={{ marginTop: 10 }}>
                    Still need:{" "}
                    {ready.missing.slice(0, 8).map((m, i) => (
                      <span key={m.id}>
                        {i > 0 && ", "}
                        <Link href={`/node/${encodeURIComponent(m.id)}`}><MathText>{m.title}</MathText></Link>
                      </span>
                    ))}
                    {ready.missing.length > 8 && ` and ${ready.missing.length - 8} more`}
                  </p>
                  <Link
                    href={`/session?mode=custom&nodes=${ready.missing.slice(0, 10).map((m) => encodeURIComponent(m.id)).join(",")}`}
                    className="pill pill-accent icon-label"
                  >
                    Practice prerequisites <ArrowRight size={11} />
                  </Link>
                </div>
              )}
            </div>
          )}

          <LearningPath nodeId={id} />

          <div className="grid" style={{ marginTop: 20 }}>
            <div>
              {node.content && (
                <div className="statement-section">
                  <div className="statement-head">
                    <h2 className="statement-title">{node.type || "Statement"}</h2>
                    {(() => {
                      const words = node.content!.split(/\s+/).length;
                      const mins = Math.max(1, Math.round(words / 200));
                      return (
                        <span className="muted small">~{mins} min read · {words} words</span>
                      );
                    })()}
                  </div>
                  <Markdown>{node.content}</Markdown>
                </div>
              )}
              <PersonalNotes nodeId={id} />
              <NodeActions nodeId={id} nodePath={node.path ?? null} hasLLM={llmAvailable} />
              {llmAvailable && <ReExplain nodeId={id} />}
              {llmAvailable && <CompareWith nodeId={id} nodeTitle={node.title} />}

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
                            <div className="node-actions-row">
                              <span className="verdict-label" style={{ color: verdictColor }}>{verdictLabel}</span>
                              {a.kind && <span className="pill label-xs">{a.kind}</span>}
                            </div>
                            <span className="muted small">{new Date(a.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="attempt-problem">
                            <MathText>{truncateMath(a.problem, 200)}</MathText>
                          </p>
                          {a.gap && a.gap !== "none" && a.gap !== "(gave up — showed answer)" && (
                            <p className="muted small italic-note">
                              Gap: <MathText>{truncateMath(a.gap, 120)}</MathText>
                            </p>
                          )}
                        </div>
                      );
                    })}
                    <Link href={`/learn?node=${encodeURIComponent(id)}`} className="btn-ghost btn-sm icon-label" style={{ alignSelf: "flex-start" }}>
                      Practice again <ArrowRight size={12} />
                    </Link>
                  </div>
                </details>
              )}
            </div>
            <div>
              <NodePanels defaultOpen={0}>
                {hasPrereqGraph && (
                  <NodePanel key="prereq" id="prereq" title="How to learn this" meta={count(prereqG!.nodes.length - 1)}>
                    <PrereqGraph data={prereqG!} />
                    <p className="muted small" style={{ margin: "10px 0 0" }}>
                      Foundations sit at the bottom — work upward to this concept. Tap a node to open it.
                    </p>
                  </NodePanel>
                )}
                {ego && (
                  <NodePanel key="neighborhood" id="neighborhood" title="Neighborhood">
                    <EgoGraph slug={id} depth={1} initialData={ego} />
                  </NodePanel>
                )}
                <NodePanel key="outgoing" id="outgoing" title="Outgoing" meta={count(outgoing.length)}>
                  <RelList rows={outgoing} dir="out" />
                </NodePanel>
                <NodePanel key="incoming" id="incoming" title="Incoming" meta={count(incoming.length)}>
                  <RelList rows={incoming} dir="in" />
                </NodePanel>
                {similar.length > 0 && (
                  <NodePanel key="similar" id="similar" title={`Also in ${node.area}`} meta={count(similar.length)}>
                    {similar.map((s) => (
                      <div key={s.id} className="frontier-item">
                        <div>
                          {s.type && <span className={`type-badge t-${s.type}`} style={{ marginRight: 6 }}>{s.type}</span>}
                          <Link href={`/node/${encodeURIComponent(s.id)}`} className="preview-link">
                            <MathText>{s.title}</MathText>
                          </Link>
                        </div>
                        <MasteryRing p={s.mastery_p} size={34} />
                      </div>
                    ))}
                    <Link href={`/explore?view=sections&area=${encodeURIComponent(node.area!)}`} className="muted small browse-more icon-label">
                      Browse all {node.area} <ArrowRight size={11} />
                    </Link>
                  </NodePanel>
                )}
              </NodePanels>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import Link from "next/link";
import SearchBox from "./components/SearchBox";
import RandomConceptButton from "./components/RandomConceptButton";
import QuickKnown from "./components/QuickKnown";
import SnoozeButton from "./components/SnoozeButton";
import GoalButton from "./components/GoalButton";
import LearningPath from "./components/LearningPath";
import MathText from "./components/MathText";
import MasteryRing from "./components/MasteryRing";
import UnlockPreview from "./components/UnlockPreview";
import { frontier, stats, dueForReview, todayStats, recentlyPracticed, bookmarkedNodes, conceptOfDay, areaMastery, overconfidentConcepts, getNode, examPacing } from "@/lib/queries";
import { getDailyGoal, getLearningGoal } from "@/lib/settings";
import { ArrowRight, ArrowDown, Star } from "./components/Icons";

export const dynamic = "force-dynamic";

function DueBar({ decayed, original }: { decayed: number; original: number }) {
  return (
    <div className="due-bar">
      <div className="bar" style={{ width: 60 }}>
        <span style={{ width: `${Math.round(decayed * 100)}%`, background: "var(--amber)" }} />
      </div>
      <span className="small" style={{ color: "var(--amber)" }}>
        {Math.round(decayed * 100)}%
      </span>
      <span className="small muted icon-label"><ArrowDown size={10} /> {Math.round(original * 100)}%</span>
    </div>
  );
}

export default function Home() {
  const DAILY_GOAL = getDailyGoal();
  const s = stats();
  const front = frontier(20);
  const due = dueForReview(8);
  const today = todayStats();
  const recent = recentlyPracticed(6);
  const bookmarks = bookmarkedNodes();
  const spotlight = conceptOfDay();
  const areas = areaMastery().slice(0, 12);
  const blindSpots = overconfidentConcepts(5);
  const goalId = getLearningGoal();
  const goalNode = goalId ? getNode(goalId) : null;
  const pacing = examPacing();

  return (
    <div className="wrap">
      <header className="top borderless">
        <div>
          <h1>Proofer</h1>
          <p className="tag">
            AI tutor that models your understanding of mathematics
          </p>
        </div>
        <span className="cta-slot">
          <Link href="/session" className="cta icon-label">Start session <ArrowRight size={13} /></Link>
        </span>
      </header>

      <div className="stat-row">
        <div className="stat"><div className="n">{s.real}</div><div className="l">concepts</div></div>
        <div className="stat"><div className="n">{s.dependsOn}</div><div className="l">prerequisites</div></div>
        <div className="stat"><div className="n">{s.known}</div><div className="l">mastered</div></div>
        <div className="stat"><div className="n">{s.practiced}</div><div className="l">attempts</div></div>
        <div className="stat">
          <div className="n" style={{ color: due.length > 0 ? "var(--amber)" : undefined }}>{due.length}</div>
          <div className="l">due today</div>
        </div>
      </div>

      {/* Daily goal + streak */}
      <div className="daily-goal-bar" style={{ marginBottom: 20 }}>
        <div className="goal-header">
          <span className="goal-label" style={{ color: today.today_concepts >= DAILY_GOAL ? "var(--green)" : undefined }}>
            {today.today_concepts >= DAILY_GOAL
              ? `Daily goal reached — ${today.today_concepts} concepts`
              : `Today: ${today.today_concepts} / ${DAILY_GOAL} concepts`}
          </span>
          <span className="goal-right">
            {today.streak_days > 0 && (
              <span className="streak-label">
                {today.streak_days} day{today.streak_days !== 1 ? "s" : ""} streak
              </span>
            )}
            <Link href="/session" className="pill pill-accent icon-label">
              start session <ArrowRight size={11} />
            </Link>
          </span>
        </div>
        <div className="bar" style={{ height: 6 }}>
          <span style={{
            width: `${Math.min(100, Math.round((today.today_concepts / DAILY_GOAL) * 100))}%`,
            background: today.today_concepts >= DAILY_GOAL ? "var(--green)" : "var(--accent-strong)",
          }} />
        </div>
      </div>

      {/* Exam pacing — only shown once a target is set (Settings) */}
      {pacing.length > 0 && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <h2>Exam pacing</h2>
          <div className="flex-col" style={{ gap: 10 }}>
            {pacing.map((p) => (
              <div key={p.scopeKey} className="area-row">
                <Link href={`/session?mode=area&area=${encodeURIComponent(p.scopeValue)}`} className="area-name">
                  {p.scopeValue}
                </Link>
                <span className="muted small" style={{ flexShrink: 0 }}>
                  {p.daysLeft >= 0 ? `${p.daysLeft}d left` : "past due"}
                </span>
                <span className="muted small" style={{ flexShrink: 0 }}>{p.unmastered} to go</span>
                <span
                  className={`small ${p.behind ? "pill-red" : "pill-green"}`}
                  style={{ flexShrink: 0 }}
                >
                  {Number.isFinite(p.requiredPace) ? p.requiredPace.toFixed(1) : "∞"}/day needed · you&rsquo;re at {p.actualPace.toFixed(1)}
                  {p.behind ? " — behind" : ""}
                </span>
                <Link
                  href={`/session?mode=area&area=${encodeURIComponent(p.scopeValue)}`}
                  className="pill pill-accent pill-xs"
                  style={{ flexShrink: 0 }}
                >
                  drill
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="search-row">
        <div className="search-flex">
          <SearchBox />
        </div>
        <RandomConceptButton />
      </div>

      {/* Concept of the Day */}
      {spotlight && (
        <div className="panel panel-spotlight">
          <div className="spotlight-inner">
            <div className="spotlight-body">
              <h2 className="accent">Concept of the day</h2>
              <div className="spotlight-meta">
                {spotlight.type && <span className={`type-badge t-${spotlight.type}`}>{spotlight.type}</span>}
                {spotlight.area && <span className="muted small">{spotlight.area}</span>}
                <span className="pill label-xs">
                  {spotlight.reason === "frontier" ? "all prereqs ready" : "unmastered"}
                </span>
              </div>
              <Link
                href={`/node/${encodeURIComponent(spotlight.id)}`}
                className="spotlight-title"
              >
                <MathText>{spotlight.title}</MathText>
              </Link>
              {spotlight.overview && (
                <p className="muted spotlight-overview">
                  <MathText>{spotlight.overview.length > 200 ? spotlight.overview.slice(0, 200) + "…" : spotlight.overview}</MathText>
                </p>
              )}
            </div>
            <div className="spotlight-actions">
              <Link
                href={`/learn?node=${encodeURIComponent(spotlight.id)}`}
                className="cta cta-sm icon-label"
              >
                Practice <ArrowRight size={12} />
              </Link>
              <Link
                href={`/node/${encodeURIComponent(spotlight.id)}`}
                className="btn-ghost spotlight-read"
              >
                Read
              </Link>
            </div>
          </div>
          <div className="spotlight-mastery">
            <div className="bar spotlight-bar">
              <span style={{ width: `${Math.round(spotlight.mastery_p * 100)}%` }} />
            </div>
            <span className="muted small">{Math.round(spotlight.mastery_p * 100)}% mastery</span>
          </div>
        </div>
      )}

      {/* Due for review — shown prominently when non-empty */}
      {due.length > 0 && (
        <div className="panel panel-due" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <h2 className="amber">Due for review</h2>
            <Link
              href="/session?mode=due"
              className="cta icon-label"
            >
              Review all {due.length} <ArrowRight size={13} />
            </Link>
          </div>
          {due.map((n) => (
            <div className="frontier-item" key={n.id}>
              <div style={{ minWidth: 0 }}>
                {n.type && <span className={`type-badge t-${n.type}`} style={{ marginRight: 8 }}>{n.type}</span>}
                <Link href={`/node/${encodeURIComponent(n.id)}`}><MathText>{n.title}</MathText></Link>
                {n.area && <span className="muted small"> · {n.area}</span>}
              </div>
              <div className="due-actions">
                <DueBar decayed={(n as any).p_decayed} original={n.mastery_p} />
                <SnoozeButton nodeId={n.id} />
                <Link
                  href={`/learn?node=${encodeURIComponent(n.id)}`}
                  className="pill pill-amber icon-label"
                >
                  review <ArrowRight size={10} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Learning Goal — prominently show the path to the student's target concept */}
      {goalNode && goalNode.exists_ === 1 && (
        <div className="panel panel-goal" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div>
              <h2 className="accent">Learning goal</h2>
              <p className="muted small" style={{ margin: "2px 0 0" }}>
                Your target concept — here's what stands between you and mastering it.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              <Link
                href={`/path/${encodeURIComponent(goalId)}`}
                className="cta cta-sm icon-label"
              >
                Guided path <ArrowRight size={12} />
              </Link>
              <Link
                href={`/node/${encodeURIComponent(goalId)}`}
                className="btn-ghost btn-sm icon-label"
              >
                View
              </Link>
              <GoalButton nodeId={goalId} isCurrentGoal={true} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
            {goalNode.type && (
              <span className={`type-badge t-${goalNode.type}`}>{goalNode.type}</span>
            )}
            <Link href={`/node/${encodeURIComponent(goalId)}`} className="concept-link" style={{ fontWeight: 600 }}>
              <MathText>{goalNode.title}</MathText>
            </Link>
            {goalNode.area && <span className="muted small">{goalNode.area}</span>}
          </div>
          {goalNode.overview && (
            <MathText className="muted small" style={{ marginBottom: 12 }}>
              {goalNode.overview.length > 160 ? goalNode.overview.slice(0, 160) + "…" : goalNode.overview}
            </MathText>
          )}
          {/* Reuse the LearningPath component — it computes the unmastered prereq path server-side */}
          <LearningPath nodeId={goalId} />
        </div>
      )}

      {/* Blind spots — concepts you rate higher than your results justify */}
      {blindSpots.length > 0 && (
        <div className="panel panel-blindspots" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div>
              <h2 className="red">Blind spots</h2>
              <p className="muted small" style={{ margin: "2px 0 0" }}>
                You rate these higher than your results justify — the best place to practice.
              </p>
            </div>
            <Link href="/session?mode=blindspots" className="cta icon-label">
              Drill all {blindSpots.length} <ArrowRight size={13} />
            </Link>
          </div>
          {blindSpots.map((n) => (
            <div className="frontier-item" key={n.id}>
              <div style={{ minWidth: 0 }}>
                {n.type && <span className={`type-badge t-${n.type}`} style={{ marginRight: 8 }}>{n.type}</span>}
                <Link href={`/node/${encodeURIComponent(n.id)}`}><MathText>{n.title}</MathText></Link>
                {n.area && <span className="muted small"> · {n.area}</span>}
              </div>
              <div className="item-actions">
                <span className="pill pill-red pill-xs" title="how much your confidence exceeds your performance">
                  +{Math.round(n.overconf * 100)}pp overrated
                </span>
                <Link href={`/learn?node=${encodeURIComponent(n.id)}`} className="pill pill-accent icon-label">
                  practice <ArrowRight size={10} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid">
        <div>
          {/* Recently practiced — jump back in */}
          {recent.length > 0 && (
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-header">
                <h2>Jump back in</h2>
                <Link href="/progress" className="small accent-link icon-label">All activity <ArrowRight size={11} /></Link>
              </div>
              <div className="action-row">
                {recent.map((n) => (
                  <Link key={n.id} href={`/learn?node=${encodeURIComponent(n.id)}`} className="recent-chip">
                    <span
                      className="verdict-dot-sm"
                      style={{
                        background: n.last_verdict === "correct" ? "var(--green)"
                          : n.last_verdict === "partial" ? "var(--amber)"
                          : "var(--red)",
                      }}
                    />
                    <MathText>{n.title}</MathText>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="panel">
          <h2>Knowledge frontier — ready to learn next</h2>
          <p className="muted small" style={{ marginTop: -4 }}>
            Concepts whose every prerequisite you already know.{" "}
            {s.known === 0 &&
              "Haven't marked anything known yet — these are the foundations. Open one and mark it known to watch the frontier grow."}
          </p>
          {front.length === 0 && (
            <p className="muted">Nothing on the frontier — mark some concepts as known to begin.</p>
          )}
          {front.map((n) => (
            <div className="frontier-item" key={n.id}>
              <div>
                <span className={`type-badge t-${n.type || "ghost"}`} style={{ marginRight: 8 }}>
                  {n.type || "?"}
                </span>
                <Link href={`/node/${encodeURIComponent(n.id)}`}><MathText>{n.title}</MathText></Link>
                {n.area && <span className="meta"> · {n.area}</span>}
              </div>
              <div className="item-actions">
                {n.unlocks > 0 && <UnlockPreview nodeId={n.id} unlockCount={n.unlocks} />}
                <QuickKnown nodeId={n.id} />
                <Link
                  href={`/learn?node=${encodeURIComponent(n.id)}`}
                  className="pill pill-accent icon-label"
                >
                  practice <ArrowRight size={10} />
                </Link>
              </div>
            </div>
          ))}
          </div>{/* end frontier panel */}
        </div>{/* end left column */}

        <div className="progress-right-col">
          {bookmarks.length > 0 && (
            <div className="panel">
              <h2 className="icon-label"><Star size={14} filled /> Bookmarked</h2>
              {bookmarks.map((n) => (
                <div className="frontier-item" key={n.id}>
                  <div>
                    {n.type && <span className={`type-badge t-${n.type}`} style={{ marginRight: 6 }}>{n.type}</span>}
                    <Link href={`/node/${encodeURIComponent(n.id)}`} className="text-link"><MathText>{n.title}</MathText></Link>
                  </div>
                  <div className="item-actions">
                    <MasteryRing p={n.mastery_p} size={32} />
                    <Link href={`/learn?node=${encodeURIComponent(n.id)}`} className="pill pill-accent icon-label">
                      practice <ArrowRight size={10} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="panel">
            <div className="panel-header">
              <h2>Areas</h2>
              <Link href="/explore?view=sections" className="small icon-label">Browse all <ArrowRight size={11} /></Link>
            </div>
            {areas.map((a) => {
              const pct = Math.round(a.avg_p * 100);
              const color = pct >= 80 ? "var(--green)" : pct >= 40 ? "var(--amber)" : "var(--muted)";
              return (
                <div className="frontier-item area-home-row" key={a.area}>
                  <Link href={`/explore?view=sections&area=${encodeURIComponent(a.area)}`} className="text-link area-home-name">
                    {a.area}
                  </Link>
                  <div className="area-home-right">
                    <div className="bar" style={{ width: 48 }}>
                      <span style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="muted small" style={{ color, minWidth: 28, textAlign: "right" }}>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

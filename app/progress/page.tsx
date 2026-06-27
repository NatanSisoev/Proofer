import Link from "next/link";
import { masteryHistogram, recentAttemptsGlobal, weakSpots, stats, todayStats, reviewForecast, masteryVelocity, activityCalendar, areaMastery, masteryMilestones, recurringWeakPrerequisites, calibration } from "@/lib/queries";
import ActivityCalendar from "@/app/components/ActivityCalendar";
import ProgressTabs from "@/app/components/ProgressTabs";
import { getDailyGoal } from "@/lib/settings";
import { VERDICT, type Verdict } from "@/lib/verdict";
import { VerdictIcon, ArrowRight, Download, Sparkles } from "@/app/components/Icons";
import EmptyState from "@/app/components/EmptyState";
import MathText from "@/app/components/MathText";

export const dynamic = "force-dynamic";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

export default function ProgressPage() {
  const DAILY_GOAL = getDailyGoal();
  const s = stats();
  const hist = masteryHistogram();
  const recent = recentAttemptsGlobal(40);
  const weak = weakSpots(12);
  const today = todayStats();
  const forecast = reviewForecast();
  const velocity = masteryVelocity();
  const calendar = activityCalendar();
  const areas = areaMastery();
  const milestones = masteryMilestones();
  const weakPrereqs = recurringWeakPrerequisites(6);
  const calib = calibration();

  const masteredPct = s.real > 0 ? Math.round((s.known / s.real) * 100) : 0;
  const maxBucket = Math.max(...hist.map((h) => h.count), 1);

  return (
    <div className="wrap">
      <div className="page-top">
        <div>
          <h1>Progress</h1>
          <p className="muted small" style={{ marginTop: 4 }}>Your mastery across {s.real} concepts</p>
        </div>
        <div className="page-actions">
          <Link href="/session" className="pill pill-accent icon-label">
            Start session <ArrowRight size={11} />
          </Link>
          <a href="/api/export/mastery" download="proofer-mastery.csv" className="muted small icon-label" style={{ textDecoration: "none" }}>
            <Download size={12} /> CSV
          </a>
          <a href="/api/export/anki?mastered=false" download="proofer-anki.txt" className="muted small icon-label" style={{ textDecoration: "none" }}>
            <Download size={12} /> Anki deck
          </a>
        </div>
      </div>

      <ProgressTabs active="overview" />

      {/* Summary stats */}
      <div className="stat-row" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="n">{s.known}</div>
          <div className="l">mastered</div>
        </div>
        <div className="stat">
          <div className="n">{masteredPct}%</div>
          <div className="l">of concepts</div>
        </div>
        <div className="stat">
          <div className="n">{s.practiced}</div>
          <div className="l">attempts</div>
        </div>
        <div className="stat">
          <div className="n">{s.real - s.known}</div>
          <div className="l">remaining</div>
        </div>
        {today.streak_days > 0 && (
          <div className="stat">
            <div className="n" style={{ color: "var(--amber)" }}>{today.streak_days}</div>
            <div className="l">day streak</div>
          </div>
        )}
        <div className="stat">
          <div className="n" style={{ color: today.today_concepts >= DAILY_GOAL ? "var(--green)" : undefined }}>
            {today.today_concepts}/{DAILY_GOAL}
          </div>
          <div className="l">today's goal</div>
        </div>
        {(velocity.last7 > 0 || velocity.last30 > 0) && (
          <div className="stat">
            <div className="n" style={{ color: "var(--green)" }}>{velocity.last7}</div>
            <div className="l">mastered this week</div>
          </div>
        )}
      </div>

      {/* Activity calendar — full width */}
      <div className="panel panel-activity">
        <h2>Activity — last 12 weeks</h2>
        <ActivityCalendar data={calendar} />
      </div>

      <div className="grid" style={{ gap: 20 }}>
        {/* Left column */}
        <div className="progress-left-col">
          {/* Cumulative mastery chart */}
          {milestones.length >= 2 && (
            <div className="panel">
              <h2>Concepts mastered over time</h2>
              {(() => {
                const maxVal = milestones[milestones.length - 1].cumulative;
                const chartH = 72;
                const pts = milestones.map((m, i) => ({
                  x: i / (milestones.length - 1),
                  y: 1 - m.cumulative / maxVal,
                  day: m.day,
                  val: m.cumulative,
                }));
                const toSvgX = (x: number) => x * 100;
                const toSvgY = (y: number) => y * chartH;
                const d = pts
                  .map((p, i) => `${i === 0 ? "M" : "L"} ${toSvgX(p.x).toFixed(2)},${toSvgY(p.y).toFixed(2)}`)
                  .join(" ");
                const fill = d + ` L ${toSvgX(1)},${chartH} L ${toSvgX(0)},${chartH} Z`;
                return (
                  <div style={{ position: "relative" }}>
                    <svg
                      viewBox={`0 0 100 ${chartH}`}
                      preserveAspectRatio="none"
                      className="chart-svg"
                      style={{ height: chartH }}
                    >
                      <path d={fill} fill="var(--accent-soft)" />
                      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                    </svg>
                    <div className="chart-label-row">
                      <span className="muted small label-xs">{milestones[0].day}</span>
                      <span className="chart-label-accent">{maxVal} mastered</span>
                      <span className="muted small label-xs">{milestones[milestones.length - 1].day}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Histogram */}
          <div className="panel">
            <h2>Mastery distribution</h2>
            <div className="hist-bars">
              {hist.map((h) => {
                const pct = h.count / maxBucket;
                const label = h.bucket === 10 ? "100%" : `${h.bucket * 10}%`;
                const isGood = h.bucket >= 8;
                return (
                  <div key={h.bucket} className="hist-bar-col">
                    <div
                      className="hist-bar"
                      style={{
                        height: `${Math.max(4, pct * 72)}px`,
                        background: isGood ? "var(--green)" : h.bucket >= 4 ? "var(--amber)" : "var(--muted)",
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="hist-labels">
              {hist.map((h) => (
                <div key={h.bucket} className="hist-label">
                  {h.bucket * 10}
                </div>
              ))}
            </div>
            <p className="small muted" style={{ marginTop: 8 }}>
              {hist.filter((h) => h.bucket >= 8).reduce((s, h) => s + h.count, 0)} concepts at 80%+ mastery ·{" "}
              {hist.filter((h) => h.bucket < 2).reduce((s, h) => s + h.count, 0)} never practiced
            </p>
          </div>

          {/* Recent activity */}
          <div className="panel">
            <div className="panel-header">
              <h2>Recent attempts</h2>
            </div>
            {recent.length === 0 && <EmptyState icon={<Sparkles size={18} />}>No attempts yet — start practicing!</EmptyState>}
            <div className="recent-list">
              {recent.map((a) => (
                <div key={a.id} className="attempt-row">
                  <span
                    className="verdict-dot icon-label"
                    style={{ color: VERDICT[a.verdict as Verdict]?.color || "var(--muted)" }}
                  >
                    {a.verdict in VERDICT ? <VerdictIcon verdict={a.verdict as Verdict} size={11} /> : "?"}
                  </span>
                  <div className="attempt-body">
                    <Link
                      href={`/node/${encodeURIComponent(a.node_id)}`}
                      className="attempt-link"
                    >
                      <MathText>{(a as any).title || a.node_id}</MathText>
                    </Link>
                    {a.gap && a.gap !== "none" && a.gap !== "(gave up — showed answer)" && (
                      <p className="muted small attempt-gap">
                        <MathText>{a.gap}</MathText>
                      </p>
                    )}
                    {a.gap === "(gave up — showed answer)" && (
                      <p className="muted small attempt-gap" style={{ fontStyle: "italic" }}>
                        viewed answer
                      </p>
                    )}
                  </div>
                  <div className="attempt-meta-col">
                    <span className="small muted">{timeAgo(a.created_at)}</span>
                    <Link href={`/learn?node=${encodeURIComponent(a.node_id)}`} className="pill pill-accent icon-label">
                      retry <ArrowRight size={10} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="progress-right-col">
          {/* Calibration — how well your confidence matches reality */}
          {calib.n > 0 && calib.brier !== null && (() => {
            // Brier score 0 = perfect, 1 = worst. Bias > 0 means overconfident.
            const score = Math.round((1 - calib.brier) * 100); // higher = better calibrated
            const bias = calib.bias ?? 0;
            const verdict =
              bias > 0.12 ? { label: "You tend to be overconfident", color: "var(--red)" }
              : bias < -0.12 ? { label: "You tend to underrate yourself", color: "var(--amber)" }
              : { label: "Your confidence is well-calibrated", color: "var(--green)" };
            return (
              <div className="panel">
                <div className="panel-header">
                  <h2>Calibration</h2>
                  <span className="muted small">{calib.n} rated</span>
                </div>
                <p className="muted small panel-desc">
                  How well your pre-answer confidence matches how you actually did —
                  the honest measure of what you really know.
                </p>
                <div className="calib-headline">
                  <span className="calib-score" style={{ color: verdict.color }}>{score}</span>
                  <span className="muted small">/ 100 calibration</span>
                </div>
                <p className="small" style={{ color: verdict.color, margin: "2px 0 0" }}>
                  {verdict.label}
                </p>
                {calib.overconfident.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p className="muted small panel-desc" style={{ marginBottom: 6 }}>
                      You think you know these better than you do:
                    </p>
                    <div className="flex-col" style={{ gap: 6 }}>
                      {calib.overconfident.map((c) => (
                        <div key={c.node_id} className="area-row">
                          <Link href={`/node/${encodeURIComponent(c.node_id)}`} className="area-name">
                            <MathText>{c.title}</MathText>
                          </Link>
                          <span className="pill pill-red pill-xs" title="confidence minus actual performance">
                            +{Math.round(c.overconf * 100)}pp
                          </span>
                          <Link
                            href={`/learn?node=${encodeURIComponent(c.node_id)}`}
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
              </div>
            );
          })()}

          {/* Per-area mastery breakdown */}
          {areas.length > 0 && (
            <div className="panel">
              <div className="panel-header">
                <h2>Mastery by area</h2>
                {areas.length > 0 && (
                  <Link
                    href={`/session?mode=area&area=${encodeURIComponent(areas[areas.length - 1].area)}`}
                    className="pill pill-red pill-sm icon-label"
                    title={`Weakest area: ${areas[areas.length - 1].area}`}
                  >
                    Drill weakest <ArrowRight size={10} />
                  </Link>
                )}
              </div>
              <div className="flex-col" style={{ gap: 6 }}>
                {areas.map((a) => {
                  const pct = Math.round(a.avg_p * 100);
                  const masteredPct = a.total > 0 ? Math.round((a.mastered / a.total) * 100) : 0;
                  const color = pct >= 80 ? "var(--green)" : pct >= 40 ? "var(--amber)" : "var(--muted)";
                  return (
                    <div key={a.area} className="area-row">
                      <Link href={`/browse?area=${encodeURIComponent(a.area)}`} className="area-name">
                        {a.area}
                      </Link>
                      <div className="bar area-row-bar">
                        <span style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className="muted small area-pct">{pct}%</span>
                      <span className="muted small area-count" style={{ color: masteredPct === 100 ? "var(--green)" : undefined }}>
                        {a.mastered}/{a.total}
                      </span>
                      <Link
                        href={`/session?mode=area&area=${encodeURIComponent(a.area)}`}
                        className="pill pill-accent pill-xs"
                        style={{ flexShrink: 0 }}
                      >
                        drill
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recurring weak prerequisites — cross-concept misconception signal */}
          {weakPrereqs.length > 0 && (
            <div className="panel">
              <h2>Foundations tripping you up</h2>
              <p className="muted small panel-desc">
                Prerequisites the tutor blamed across multiple concepts. Fixing one
                of these lifts everything that depends on it.
              </p>
              <div className="flex-col" style={{ gap: 8 }}>
                {weakPrereqs.map((w) => {
                  const concepts = w.concepts.split(",").filter(Boolean);
                  return (
                    <div key={w.prereq} className="cycle-card">
                      <div className="weak-prereq-header">
                        <div className="weak-prereq-name">
                          {w.exists_ === 1 ? (
                            <Link href={`/node/${encodeURIComponent(w.prereq)}`} className="weak-prereq-title">
                              <MathText>{w.prereq}</MathText>
                            </Link>
                          ) : (
                            <span className="weak-prereq-title muted" title="No note yet — a gap in your graph">
                              <MathText>{w.prereq}</MathText> <span className="pill pill-xs">gap</span>
                            </span>
                          )}
                          <span className="pill pill-red pill-xs">
                            {w.concept_count} concepts
                          </span>
                        </div>
                        {w.exists_ === 1 && (
                          <Link href={`/learn?node=${encodeURIComponent(w.prereq)}`} className="pill pill-accent icon-label" style={{ flexShrink: 0 }}>
                            drill <ArrowRight size={10} />
                          </Link>
                        )}
                      </div>
                      <p className="muted small weak-prereq-blocks">
                        Blocks:{" "}
                        {concepts.slice(0, 3).map((c, i) => (
                          <span key={c}>
                            {i > 0 && ", "}
                            <Link href={`/node/${encodeURIComponent(c)}`}><MathText>{c}</MathText></Link>
                          </span>
                        ))}
                        {concepts.length > 3 && ` +${concepts.length - 3} more`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 7-day review forecast */}
          <div className="panel">
            <h2>Review forecast — next 7 days</h2>
            {forecast.every((d) => d.count === 0) ? (
              <p className="muted small">No reviews scheduled — practice more concepts to build a review queue.</p>
            ) : (
              <div>
                {(() => {
                  const maxCount = Math.max(...forecast.map((d) => d.count), 1);
                  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                  return (
                    <div className="forecast-chart">
                      {forecast.map((d, i) => {
                        const date = new Date(d.date + "T12:00:00");
                        const isToday = i === 0;
                        const barH = d.count > 0 ? Math.max(8, Math.round((d.count / maxCount) * 56)) : 3;
                        return (
                          <div key={d.date} className="forecast-day">
                            <span className="muted small label-xs">
                              {d.count > 0 ? d.count : ""}
                            </span>
                            <div
                              className="forecast-bar"
                              style={{
                                height: barH,
                                background: isToday ? "var(--amber)" : "var(--accent-strong)",
                                opacity: d.count === 0 ? 0.2 : 0.85,
                              }}
                            />
                            <span className="muted small label-xs" style={{ color: isToday ? "var(--amber)" : undefined }}>
                              {isToday ? "today" : days[date.getDay()]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                <p className="muted small" style={{ margin: 0 }}>
                  {forecast.reduce((s, d) => s + d.count, 0)} reviews coming up · practice now to shift them later
                </p>
              </div>
            )}
          </div>

          <div className="panel">
            <h2>Weak spots</h2>
            <p className="muted small panel-desc">
              Concepts you've practiced but haven't mastered yet.
            </p>
            {weak.length === 0 && <p className="muted">Nothing here yet — keep practicing!</p>}
            {weak.map((n) => (
              <div key={n.id} className="frontier-item">
                <div>
                  {n.type && <span className={`type-badge t-${n.type}`} style={{ marginRight: 6 }}>{n.type}</span>}
                  <Link href={`/node/${encodeURIComponent(n.id)}`} className="preview-link">
                    <MathText>{n.title}</MathText>
                  </Link>
                </div>
                <div className="weak-spot-right">
                  <div className="bar" style={{ width: 60 }}>
                    <span style={{ width: `${Math.round(n.mastery_p * 100)}%` }} />
                  </div>
                  <span className="small muted">{Math.round(n.mastery_p * 100)}%</span>
                  <Link href={`/learn?node=${encodeURIComponent(n.id)}`} className="pill pill-accent icon-label">
                    drill <ArrowRight size={10} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>{/* end right column */}
      </div>
    </div>
  );
}

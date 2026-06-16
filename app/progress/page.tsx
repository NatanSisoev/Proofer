import Link from "next/link";
import { masteryHistogram, recentAttemptsGlobal, weakSpots, stats, todayStats, reviewForecast, masteryVelocity, activityCalendar, areaMastery, masteryMilestones, recurringWeakPrerequisites } from "@/lib/queries";
import ActivityCalendar from "@/app/components/ActivityCalendar";
import { getDailyGoal } from "@/lib/settings";
import { VERDICT, type Verdict } from "@/lib/verdict";

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

  const masteredPct = s.real > 0 ? Math.round((s.known / s.real) * 100) : 0;
  const maxBucket = Math.max(...hist.map((h) => h.count), 1);

  return (
    <div className="wrap">
      <div className="page-top">
        <div>
          <h1>Progress</h1>
          <p className="muted small" style={{ marginTop: 4 }}>Your mastery across {s.real} concepts</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/session" className="pill" style={{ color: "var(--accent)", borderColor: "var(--accent-soft)" }}>
            Start session →
          </Link>
          <a href="/api/export/mastery" download="proofer-mastery.csv" className="muted small" style={{ textDecoration: "none" }}>
            ↓ CSV
          </a>
          <a href="/api/export/anki?mastered=false" download="proofer-anki.txt" className="muted small" style={{ textDecoration: "none" }}>
            ↓ Anki deck
          </a>
          <Link href="/" className="muted small">← home</Link>
        </div>
      </div>

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
      <div className="panel" style={{ marginBottom: 20, overflowX: "auto" }}>
        <h2>Activity — last 12 weeks</h2>
        <ActivityCalendar data={calendar} />
      </div>

      <div className="grid" style={{ gap: 20 }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
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
                      style={{ width: "100%", height: chartH, display: "block" }}
                    >
                      <path d={fill} fill="var(--accent-soft)" />
                      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                    </svg>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span className="muted small" style={{ fontSize: 10 }}>{milestones[0].day}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
                        {maxVal} mastered
                      </span>
                      <span className="muted small" style={{ fontSize: 10 }}>{milestones[milestones.length - 1].day}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Histogram */}
          <div className="panel">
            <h2>Mastery distribution</h2>
            <div style={{ display: "flex", gap: 4, height: 80, alignItems: "flex-end", marginBottom: 4 }}>
              {hist.map((h) => {
                const pct = h.count / maxBucket;
                const label = h.bucket === 10 ? "100%" : `${h.bucket * 10}%`;
                const isGood = h.bucket >= 8;
                return (
                  <div key={h.bucket} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <div
                      style={{
                        width: "100%",
                        height: `${Math.max(4, pct * 72)}px`,
                        background: isGood ? "var(--green)" : h.bucket >= 4 ? "var(--amber)" : "var(--muted)",
                        borderRadius: "3px 3px 0 0",
                        opacity: 0.85,
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {hist.map((h) => (
                <div key={h.bucket} style={{ flex: 1, textAlign: "center", fontSize: 10, color: "var(--muted)" }}>
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
              <Link href="/history" className="small" style={{ color: "var(--accent)" }}>
                Full history →
              </Link>
            </div>
            {recent.length === 0 && <p className="muted">No attempts yet — start practicing!</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {recent.map((a) => (
                <div key={a.id} className="attempt-row">
                  <span
                    className="verdict-dot"
                    style={{ color: VERDICT[a.verdict as Verdict]?.color || "var(--muted)" }}
                  >
                    {VERDICT[a.verdict as Verdict]?.icon || "?"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link
                      href={`/node/${encodeURIComponent(a.node_id)}`}
                      style={{ fontWeight: 500, fontSize: 13.5 }}
                    >
                      {(a as any).title || a.node_id}
                    </Link>
                    {a.gap && a.gap !== "none" && a.gap !== "(gave up — showed answer)" && (
                      <p className="muted small" style={{ margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.gap}
                      </p>
                    )}
                    {a.gap === "(gave up — showed answer)" && (
                      <p className="muted small" style={{ margin: "1px 0 0", fontStyle: "italic" }}>
                        viewed answer
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                    <span className="small muted">{timeAgo(a.created_at)}</span>
                    <Link href={`/learn?node=${encodeURIComponent(a.node_id)}`} className="pill" style={{ color: "var(--accent)", borderColor: "var(--accent-soft)" }}>
                      retry →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Per-area mastery breakdown */}
          {areas.length > 0 && (
            <div className="panel">
              <div className="panel-header">
                <h2>Mastery by area</h2>
                {areas.length > 0 && (
                  <Link
                    href={`/session?mode=area&area=${encodeURIComponent(areas[areas.length - 1].area)}`}
                    className="pill"
                    style={{ color: "var(--red)", fontSize: 11 }}
                    title={`Weakest area: ${areas[areas.length - 1].area}`}
                  >
                    Drill weakest →
                  </Link>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {areas.map((a) => {
                  const pct = Math.round(a.avg_p * 100);
                  const masteredPct = a.total > 0 ? Math.round((a.mastered / a.total) * 100) : 0;
                  const color = pct >= 80 ? "var(--green)" : pct >= 40 ? "var(--amber)" : "var(--muted)";
                  return (
                    <div key={a.area} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Link
                        href={`/browse?area=${encodeURIComponent(a.area)}`}
                        style={{ fontSize: 13, color: "var(--text)", minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {a.area}
                      </Link>
                      <div className="bar" style={{ width: 60, flexShrink: 0 }}>
                        <span style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className="muted small" style={{ width: 30, textAlign: "right", flexShrink: 0, fontSize: 11 }}>
                        {pct}%
                      </span>
                      <span className="muted small" style={{ fontSize: 10, width: 32, textAlign: "right", flexShrink: 0, color: masteredPct === 100 ? "var(--green)" : undefined }}>
                        {a.mastered}/{a.total}
                      </span>
                      <Link
                        href={`/session?mode=area&area=${encodeURIComponent(a.area)}`}
                        className="pill"
                        style={{ fontSize: 10, color: "var(--accent)", borderColor: "var(--accent-soft)", flexShrink: 0 }}
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
              <p className="muted small" style={{ marginTop: -4, marginBottom: 12 }}>
                Prerequisites the tutor blamed across multiple concepts. Fixing one
                of these lifts everything that depends on it.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {weakPrereqs.map((w) => {
                  const concepts = w.concepts.split(",").filter(Boolean);
                  return (
                    <div key={w.prereq} className="cycle-card">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                          {w.exists_ === 1 ? (
                            <Link href={`/node/${encodeURIComponent(w.prereq)}`} style={{ fontSize: 14, fontWeight: 600 }}>
                              {w.prereq}
                            </Link>
                          ) : (
                            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)" }} title="No note yet — a gap in your graph">
                              {w.prereq} <span className="pill" style={{ fontSize: 9 }}>gap</span>
                            </span>
                          )}
                          <span className="pill" style={{ fontSize: 10, color: "var(--red)" }}>
                            {w.concept_count} concepts
                          </span>
                        </div>
                        {w.exists_ === 1 && (
                          <Link href={`/learn?node=${encodeURIComponent(w.prereq)}`} className="pill" style={{ color: "var(--accent)", borderColor: "var(--accent-soft)", flexShrink: 0 }}>
                            drill →
                          </Link>
                        )}
                      </div>
                      <p className="muted small" style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        Blocks:{" "}
                        {concepts.slice(0, 3).map((c, i) => (
                          <span key={c}>
                            {i > 0 && ", "}
                            <Link href={`/node/${encodeURIComponent(c)}`}>{c}</Link>
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
                    <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 64, marginBottom: 6 }}>
                      {forecast.map((d, i) => {
                        const date = new Date(d.date + "T12:00:00");
                        const isToday = i === 0;
                        const barH = d.count > 0 ? Math.max(8, Math.round((d.count / maxCount) * 56)) : 3;
                        return (
                          <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                            <span className="muted small" style={{ fontSize: 10, lineHeight: 1 }}>
                              {d.count > 0 ? d.count : ""}
                            </span>
                            <div
                              style={{
                                width: "100%", height: barH,
                                background: isToday ? "var(--amber)" : "var(--accent)",
                                borderRadius: 3, opacity: d.count === 0 ? 0.2 : 0.85,
                              }}
                            />
                            <span className="muted small" style={{ fontSize: 10, lineHeight: 1, color: isToday ? "var(--amber)" : undefined }}>
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
            <p className="muted small" style={{ marginTop: -4, marginBottom: 12 }}>
              Concepts you've practiced but haven't mastered yet.
            </p>
            {weak.length === 0 && <p className="muted">Nothing here yet — keep practicing!</p>}
            {weak.map((n) => (
              <div key={n.id} className="frontier-item">
                <div style={{ minWidth: 0 }}>
                  {n.type && <span className={`type-badge t-${n.type}`} style={{ marginRight: 6 }}>{n.type}</span>}
                  <Link href={`/node/${encodeURIComponent(n.id)}`} style={{ fontSize: 13.5 }}>
                    {n.title}
                  </Link>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <div className="bar" style={{ width: 60 }}>
                    <span style={{ width: `${Math.round(n.mastery_p * 100)}%` }} />
                  </div>
                  <span className="small muted">{Math.round(n.mastery_p * 100)}%</span>
                  <Link href={`/learn?node=${encodeURIComponent(n.id)}`} className="pill" style={{ color: "var(--accent)", borderColor: "var(--accent-soft)" }}>
                    drill →
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

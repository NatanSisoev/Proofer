import Link from "next/link";
import SearchBox from "./components/SearchBox";
import { frontier, stats, dueForReview, todayStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

function DueBar({ decayed, original }: { decayed: number; original: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div className="bar" style={{ width: 60 }}>
        <span style={{ width: `${Math.round(decayed * 100)}%`, background: "var(--amber)" }} />
      </div>
      <span className="small" style={{ color: "var(--amber)" }}>
        {Math.round(decayed * 100)}%
      </span>
      <span className="small muted">↓ {Math.round(original * 100)}%</span>
    </div>
  );
}

const DAILY_GOAL = 5; // concepts per day

export default function Home() {
  const s = stats();
  const front = frontier(20);
  const due = dueForReview(8);
  const today = todayStats();

  return (
    <div className="wrap">
      <header className="top">
        <h1>Proofer</h1>
        <span className="tag">a tutor that models your understanding of mathematics</span>
        <span style={{ marginLeft: "auto" }}>
          <Link href="/learn" className="cta">Practice →</Link>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            Today: {today.today_concepts} / {DAILY_GOAL} concepts
            {today.today_concepts >= DAILY_GOAL && " ✓"}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            {today.streak_days > 0 && (
              <span style={{ color: "var(--amber)", fontWeight: 600 }}>
                🔥 {today.streak_days} day{today.streak_days !== 1 ? "s" : ""}
              </span>
            )}
            <Link href="/session" className="pill" style={{ color: "var(--accent)", borderColor: "var(--accent-soft)" }}>
              start session →
            </Link>
          </span>
        </div>
        <div className="bar" style={{ height: 6 }}>
          <span style={{
            width: `${Math.min(100, Math.round((today.today_concepts / DAILY_GOAL) * 100))}%`,
            background: today.today_concepts >= DAILY_GOAL ? "var(--green)" : "var(--accent)",
          }} />
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <SearchBox />
      </div>

      {/* Due for review — shown prominently when non-empty */}
      {due.length > 0 && (
        <div className="panel" style={{ marginBottom: 20, borderColor: "#4a3a1a" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h2 style={{ margin: 0, color: "var(--amber)" }}>Due for review</h2>
            <span className="muted small">mastery is decaying — review now to keep it</span>
          </div>
          {due.map((n) => (
            <div className="frontier-item" key={n.id}>
              <div style={{ minWidth: 0 }}>
                {n.type && <span className={`type-badge t-${n.type}`} style={{ marginRight: 8 }}>{n.type}</span>}
                <Link href={`/node/${encodeURIComponent(n.id)}`}>{n.title}</Link>
                {n.area && <span className="muted small"> · {n.area}</span>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <DueBar decayed={(n as any).p_decayed} original={n.mastery_p} />
                <Link
                  href={`/learn?node=${encodeURIComponent(n.id)}`}
                  className="pill"
                  style={{ color: "var(--amber)", borderColor: "#4a3a1a" }}
                >
                  review →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid">
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
                <Link href={`/node/${encodeURIComponent(n.id)}`}>{n.title}</Link>
                {n.area && <span className="meta"> · {n.area}</span>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {n.unlocks > 0 && <span className="pill unlock">unlocks {n.unlocks}</span>}
                <Link
                  href={`/learn?node=${encodeURIComponent(n.id)}`}
                  className="pill"
                  style={{ color: "var(--accent)", borderColor: "var(--accent-soft)" }}
                >
                  practice →
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Areas</h2>
              <Link href="/browse" className="small" style={{ color: "var(--accent)" }}>Browse all →</Link>
            </div>
            {s.areas.slice(0, 12).map((a) => (
              <div className="frontier-item" key={a.area}>
                <Link href={`/browse?area=${encodeURIComponent(a.area)}`} style={{ color: "var(--text)" }}>
                  {a.area}
                </Link>
                <span className="pill">{a.c}</span>
              </div>
            ))}
          </div>

          <div className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>Navigate</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Link href="/graph" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)", color: "var(--text)" }}>
                <span style={{ fontSize: 18 }}>🗺</span>
                <div>
                  <div style={{ fontWeight: 500 }}>Knowledge map</div>
                  <div className="muted small">Full graph, colored by mastery</div>
                </div>
              </Link>
              <Link href="/progress" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)", color: "var(--text)" }}>
                <span style={{ fontSize: 18 }}>📈</span>
                <div>
                  <div style={{ fontWeight: 500 }}>Progress</div>
                  <div className="muted small">Mastery histogram & recent activity</div>
                </div>
              </Link>
              <Link href="/learn" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", color: "var(--text)" }}>
                <span style={{ fontSize: 18 }}>✏️</span>
                <div>
                  <div style={{ fontWeight: 500 }}>Practice</div>
                  <div className="muted small">AI-generated problems, Socratic grading</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

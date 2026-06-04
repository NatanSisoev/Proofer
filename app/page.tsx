import Link from "next/link";
import SearchBox from "./components/SearchBox";
import { frontier, stats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function Home() {
  const s = stats();
  const front = frontier(30);

  return (
    <div className="wrap">
      <header className="top">
        <h1>Proofer</h1>
        <span className="tag">a tutor that models your understanding of mathematics</span>
        <span style={{ marginLeft: "auto" }}>
          <Link href="/learn" className="cta">Start practicing →</Link>
        </span>
      </header>

      <div className="stat-row">
        <div className="stat"><div className="n">{s.real}</div><div className="l">concepts</div></div>
        <div className="stat"><div className="n">{s.dependsOn}</div><div className="l">prerequisites</div></div>
        <div className="stat"><div className="n">{s.known}</div><div className="l">mastered</div></div>
        <div className="stat"><div className="n">{s.practiced}</div><div className="l">attempts</div></div>
        <div className="stat"><div className="n">{s.ghost}</div><div className="l">gaps</div></div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <SearchBox />
      </div>

      <div className="grid">
        <div className="panel">
          <h2>Your knowledge frontier — ready to learn next</h2>
          <p className="muted small" style={{ marginTop: -4 }}>
            Concepts whose every prerequisite you already know. {s.known === 0 && "You haven't marked anything as known yet, so this is the foundations — the concepts nothing else depends on. Open one and mark it known to watch the frontier grow."}
          </p>
          {front.length === 0 && <p className="muted">Nothing on the frontier — mark some concepts as known to begin.</p>}
          {front.map((n) => (
            <div className="frontier-item" key={n.id}>
              <div>
                <span className={`type-badge t-${n.type || "ghost"}`} style={{ marginRight: 8 }}>{n.type || "?"}</span>
                <Link href={`/node/${encodeURIComponent(n.id)}`}>{n.title}</Link>
                {n.area && <span className="meta"> · {n.area}</span>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {n.unlocks > 0 && <span className="pill unlock">unlocks {n.unlocks}</span>}
                <Link href={`/learn?node=${encodeURIComponent(n.id)}`} className="pill" style={{ color: "var(--accent)", borderColor: "var(--accent-soft)" }}>practice →</Link>
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <h2>Areas</h2>
          {s.areas.slice(0, 16).map((a) => (
            <div className="frontier-item" key={a.area}>
              <span>{a.area}</span>
              <span className="pill">{a.c}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

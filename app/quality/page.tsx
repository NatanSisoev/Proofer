import Link from "next/link";
import { noteQuality } from "@/lib/queries";
import QualityFilters from "@/app/components/QualityFilters";

export const dynamic = "force-dynamic";

export default function QualityPage() {
  const issues = noteQuality();

  const allIssueTypes = Array.from(
    new Set(issues.flatMap((n) => n.issues))
  ).sort();

  const structural = issues.filter((n) => n.issues.some((i) => i !== "never practiced"));
  const critical = issues.filter((n) => n.score >= 40).length;
  const byIssue = Object.fromEntries(
    allIssueTypes.filter((t) => t !== "never practiced").map((t) => [t, issues.filter((n) => n.issues.includes(t)).length])
  );

  // top areas by issue count
  const areaMap = new Map<string, number>();
  for (const n of issues) {
    if (n.area) areaMap.set(n.area, (areaMap.get(n.area) ?? 0) + n.issues.length);
  }
  const topAreas = [...areaMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="wrap">
      <header className="top">
        <h1>Note quality</h1>
        <span className="tag">scan for gaps in your knowledge graph</span>
      </header>

      <div className="stat-row" style={{ marginBottom: 24 }}>
        <div className="stat">
          <div className="n" style={{ color: critical > 0 ? "var(--red)" : undefined }}>{critical}</div>
          <div className="l">critical</div>
        </div>
        <div className="stat">
          <div className="n" style={{ color: structural.length > 0 ? "var(--amber)" : undefined }}>{structural.length}</div>
          <div className="l">structural issues</div>
        </div>
        {Object.entries(byIssue).map(([t, count]) => (
          <div className="stat" key={t}>
            <div className="n">{count}</div>
            <div className="l">{t}</div>
          </div>
        ))}
      </div>

      <div className="grid" style={{ alignItems: "start" }}>
        <div>
          <QualityFilters issues={issues} allIssueTypes={allIssueTypes} />
        </div>
        <div className="panel">
          <h2>Issue hotspots by area</h2>
          {topAreas.map(([area, count]) => (
            <div key={area} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <Link href={`/browse?area=${encodeURIComponent(area)}`} style={{ color: "var(--text)", fontSize: 14 }}>{area}</Link>
              <span className="pill" style={{ color: "var(--amber)" }}>{count} issues</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

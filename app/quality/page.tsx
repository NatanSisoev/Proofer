import Link from "next/link";
import { noteQuality, linkSuggestions } from "@/lib/queries";
import QualityFilters from "@/app/components/QualityFilters";
import LinkSuggestions from "@/app/components/LinkSuggestions";

export const dynamic = "force-dynamic";

export default async function QualityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "links" ? "links" : "issues";

  const issues = noteQuality();
  const allIssueTypes = Array.from(new Set(issues.flatMap((n) => n.issues))).sort();
  const structural = issues.filter((n) => n.issues.some((i) => i !== "never practiced"));
  const critical = issues.filter((n) => n.score >= 40).length;
  const byIssue = Object.fromEntries(
    allIssueTypes.filter((t) => t !== "never practiced").map((t) => [t, issues.filter((n) => n.issues.includes(t)).length])
  );

  const areaMap = new Map<string, number>();
  for (const n of issues) {
    if (n.area) areaMap.set(n.area, (areaMap.get(n.area) ?? 0) + n.issues.length);
  }
  const topAreas = [...areaMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const suggestions = tab === "links" ? linkSuggestions(60) : [];

  // Generate an actionable summary
  const topIssue = Object.entries(byIssue).sort((a, b) => b[1] - a[1])[0];
  const topArea = topAreas[0];

  return (
    <div className="wrap">
      <header className="top">
        <h1>Note quality</h1>
        <span className="tag">
          {structural.length === 0
            ? "Your knowledge graph looks solid ✓"
            : topIssue
              ? `Top action: fix "${topIssue[0]}" (${topIssue[1]} notes${topArea ? ` — especially ${topArea[0]}` : ""})`
              : "scan for gaps in your knowledge graph"}
        </span>
      </header>

      <div className="stat-row" style={{ marginBottom: 20 }}>
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

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {[
          { key: "issues", label: "Note issues" },
          { key: "links", label: "Link suggestions" },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/quality${t.key === "issues" ? "" : "?tab=links"}`}
            style={{
              padding: "8px 16px", fontSize: 14, borderRadius: "8px 8px 0 0",
              background: tab === t.key ? "var(--panel)" : "transparent",
              border: tab === t.key ? "1px solid var(--border)" : "1px solid transparent",
              borderBottom: tab === t.key ? "1px solid var(--panel)" : "1px solid transparent",
              color: tab === t.key ? "var(--text)" : "var(--muted)",
              textDecoration: "none", fontWeight: tab === t.key ? 600 : 400,
              marginBottom: -1,
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "issues" && (
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
      )}

      {tab === "links" && (
        <LinkSuggestions initial={suggestions} />
      )}
    </div>
  );
}

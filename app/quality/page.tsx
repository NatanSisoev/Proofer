import Link from "next/link";
import { unstable_cache } from "next/cache";
import { noteQuality, linkSuggestions, dependencyCycles, relatedEdgesWithNodes, relatedEdgeCount } from "@/lib/queries";
import QualityFilters from "@/app/components/QualityFilters";
import LinkSuggestions from "@/app/components/LinkSuggestions";
import RelatedEdges from "@/app/components/RelatedEdges";
import { HAS_KEY } from "@/lib/llm";

export const dynamic = "force-dynamic";

// linkSuggestions() is an O(n^2) scan over all note content — cache it
// instead of recomputing on every /quality?tab=links request.
const getLinkSuggestions = unstable_cache(
  async (limit: number) => linkSuggestions(limit),
  ["link-suggestions"],
  { revalidate: 120 }
);

// dependencyCycles() is cheap (O(V+E)) but only changes when the graph does —
// cache it so the count badge + tab are instant on every visit.
const getDependencyCycles = unstable_cache(
  async (limit: number) => dependencyCycles(limit),
  ["dependency-cycles"],
  { revalidate: 120 }
);

// noteQuality() scans every node and its attempt history — cache it so the
// issues tab doesn't rerun the full scan on every page visit.
const getNoteQuality = unstable_cache(
  async () => noteQuality(),
  ["note-quality"],
  { revalidate: 120 }
);

export default async function QualityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "links" ? "links" : tabParam === "cycles" ? "cycles" : tabParam === "edges" ? "edges" : "issues";

  const issues = await getNoteQuality();
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

  const suggestions = tab === "links" ? await getLinkSuggestions(60) : [];
  const cycles = await getDependencyCycles(40);
  const relatedEdges = tab === "edges" ? relatedEdgesWithNodes(150) : [];
  const relatedCount = relatedEdgeCount();

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
        {cycles.length > 0 && (
          <div className="stat">
            <div className="n" style={{ color: "var(--red)" }}>{cycles.length}</div>
            <div className="l">dep cycles</div>
          </div>
        )}
        {relatedCount > 0 && (
          <div className="stat">
            <div className="n" style={{ color: "var(--amber)" }}>{relatedCount}</div>
            <div className="l">unclassified edges</div>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        {[
          { key: "issues", label: "Note issues" },
          { key: "links", label: "Link suggestions" },
          { key: "cycles", label: `Dependency cycles${cycles.length > 0 ? ` (${cycles.length})` : ""}` },
          { key: "edges", label: `Unclassified edges${relatedCount > 0 ? ` (${relatedCount})` : ""}` },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/quality${t.key === "issues" ? "" : `?tab=${t.key}`}`}
            className={`tab-link${tab === t.key ? " active" : ""}`}
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

      {tab === "edges" && (
        <div className="panel">
          <h2 style={{ marginBottom: 4 }}>Unclassified edges</h2>
          <p className="muted small" style={{ marginTop: 0, marginBottom: 16, maxWidth: 680 }}>
            These <code>related</code> edges are untyped — they link two concepts but say nothing about
            the relationship. Reclassifying them as <code>depends_on</code>, <code>generalizes</code>, etc.
            directly improves the prerequisite graph that the mastery model depends on.
            {HAS_KEY
              ? " Click \"AI classify\" to get a suggestion, then apply it or choose a different type."
              : " Add GEMINI_API_KEY or ANTHROPIC_API_KEY to enable AI suggestions."}
          </p>
          <RelatedEdges initial={relatedEdges} hasKey={HAS_KEY} />
        </div>
      )}

      {tab === "cycles" && (
        <div className="panel">
          <h2 style={{ marginBottom: 4 }}>Dependency cycles</h2>
          <p className="muted small" style={{ marginTop: 0, marginBottom: 16, maxWidth: 680 }}>
            These concepts list each other as prerequisites, directly or transitively.
            A cycle is a contradiction — you can never be &ldquo;ready&rdquo; for any concept
            in the loop, so it distorts the frontier and learning-path logic. Break each
            loop by removing or retyping one <code>depends_on</code> edge (e.g. to
            <code>related</code> or <code>generalizes</code>) in the source note.
          </p>
          {cycles.length === 0 ? (
            <p className="muted">No dependency cycles — your prerequisite graph is a clean DAG. ✓</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cycles.map((c, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 12px", borderRadius: 8,
                    border: "1px solid var(--border)", background: "var(--bg-soft)",
                    display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                  }}
                >
                  <span
                    className="pill"
                    style={{ fontSize: 10, color: c.mutual ? "var(--red)" : "var(--amber)", flexShrink: 0 }}
                  >
                    {c.mutual ? "mutual" : `${c.nodes.length}-cycle`}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13.5 }}>
                    {c.nodes.map((n, j) => (
                      <span key={j} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {j > 0 && <span className="muted" style={{ fontSize: 12 }}>{c.mutual ? "⇄" : "→"}</span>}
                        <Link href={`/node/${encodeURIComponent(n)}`}>{n}</Link>
                      </span>
                    ))}
                    {/* close the loop for cycles longer than a mutual pair */}
                    {!c.mutual && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span className="muted" style={{ fontSize: 12 }}>→</span>
                        <Link href={`/node/${encodeURIComponent(c.nodes[0])}`} className="muted">{c.nodes[0]}</Link>
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

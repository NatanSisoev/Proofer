import Link from "next/link";
import { browseAreas, nodesInArea, nodeTypes, areaMastery } from "@/lib/queries";
import type { BrowseNode } from "@/lib/queries";
import BrowseFilters from "@/app/components/BrowseFilters";

export const dynamic = "force-dynamic";

function MasteryBar({ p }: { p: number }) {
  return (
    <div className="mastery-bar-row">
      <div className="bar mastery-bar-flex">
        <span style={{ width: `${Math.round(p * 100)}%` }} />
      </div>
      <span className="small muted">{Math.round(p * 100)}%</span>
    </div>
  );
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; type?: string; sort?: string }>;
}) {
  const { area, type, sort } = await searchParams;

  if (area) {
    const validSort = (sort === "mastery_desc" || sort === "alpha") ? sort : "mastery_asc";
    const nodes = nodesInArea(area, { type, sort: validSort as any });
    const types = nodeTypes();
    const areaStats = areaMastery().find((a) => a.area === area);
    const masteredCount = areaStats?.mastered ?? 0;
    const totalCount = areaStats?.total ?? nodes.length;
    const avgMastery = areaStats?.avg_p ?? 0;

    return (
      <div className="wrap">
        <div className="breadcrumb">
          <Link href="/browse">← Topics</Link> · <strong>{area}</strong>
        </div>

        {/* Area header: mastery summary + actions */}
        <div className="area-header">
          <div>
            <h1 style={{ marginBottom: 6 }}>{area}</h1>
            <div className="mastery-summary">
              <div className="mastery-bar-row">
                <div className="bar" style={{ width: 100 }}>
                  <span style={{ width: `${Math.round(avgMastery * 100)}%` }} />
                </div>
                <span className="mastery-pct">{Math.round(avgMastery * 100)}%</span>
                <span className="muted small">avg mastery</span>
              </div>
              <span className="pill" style={{
                color: masteredCount === totalCount ? "var(--green)" : "var(--muted)",
                borderColor: masteredCount === totalCount ? "var(--green)" : undefined,
              }}>
                {masteredCount}/{totalCount} mastered
              </span>
              {areaStats?.practiced !== undefined && areaStats.practiced > 0 && (
                <span className="muted small">{areaStats.practiced} practiced</span>
              )}
            </div>
          </div>
          <Link
            href={`/session?mode=area&area=${encodeURIComponent(area)}`}
            className="cta"
            style={{ flexShrink: 0 }}
          >
            Practice {area} →
          </Link>
        </div>

        <BrowseFilters area={area} activeType={type} activeSort={sort || "mastery_asc"} types={types} />

        <div className="node-list">
          {nodes.map((n) => (
            <NodeRow key={n.id} node={n} />
          ))}
          {nodes.length === 0 && <p className="muted">No concepts match this filter.</p>}
        </div>
      </div>
    );
  }

  const areas = browseAreas();
  return (
    <div className="wrap">
      <div className="page-top">
        <div>
          <h1>Browse by Topic</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            {areas.length} topics · click any to see concepts sorted by your mastery
          </p>
        </div>
        <Link href="/" className="muted small">← home</Link>
      </div>

      <div className="area-grid">
        {areas.map((a) => (
          <Link key={a.area} href={`/browse?area=${encodeURIComponent(a.area)}`} className="area-card">
            <div className="area-name">{a.area}</div>
            <div className="small muted" style={{ marginBottom: 8 }}>{a.count} concepts</div>
            <div className="bar">
              <span style={{ width: `${Math.round(a.avg_mastery * 100)}%` }} />
            </div>
            <div className="area-card-stats">
              <span className="small muted">avg {Math.round(a.avg_mastery * 100)}%</span>
              <span className="small muted">{a.mastered}/{a.count} mastered</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function NodeRow({ node }: { node: BrowseNode }) {
  return (
    <div className="browse-row">
      <div className="browse-row-left">
        {node.type && (
          <span className={`type-badge t-${node.type}`}>{node.type}</span>
        )}
        <Link href={`/node/${encodeURIComponent(node.id)}`} className="browse-node-link">
          {node.title}
        </Link>
      </div>
      <div className="browse-row-right">
        <MasteryBar p={node.mastery_p} />
        <Link href={`/learn?node=${encodeURIComponent(node.id)}`} className="pill pill-accent" style={{ flexShrink: 0 }}>
          practice →
        </Link>
      </div>
    </div>
  );
}

import Link from "next/link";
import { browseAreas, nodesInArea, nodeTypes } from "@/lib/queries";
import type { BrowseNode } from "@/lib/queries";
import BrowseFilters from "@/app/components/BrowseFilters";

export const dynamic = "force-dynamic";

function MasteryBar({ p }: { p: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <div className="bar" style={{ flex: 1, maxWidth: 120 }}>
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

    return (
      <div className="wrap">
        <div className="breadcrumb">
          <Link href="/browse">← Topics</Link> · <strong>{area}</strong>
          <span className="muted"> ({nodes.length} concepts)</span>
        </div>

        <BrowseFilters area={area} activeType={type} activeSort={sort || "mastery_asc"} types={types} />

        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 16 }}>
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, letterSpacing: "-0.02em" }}>Browse by Topic</h1>
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
            <div className="small muted" style={{ marginTop: 4 }}>
              avg mastery {Math.round(a.avg_mastery * 100)}%
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
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
        {node.type && (
          <span className={`type-badge t-${node.type}`} style={{ flexShrink: 0 }}>{node.type}</span>
        )}
        <Link href={`/node/${encodeURIComponent(node.id)}`} style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {node.title}
        </Link>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <MasteryBar p={node.mastery_p} />
        <Link href={`/learn?node=${encodeURIComponent(node.id)}`} className="pill" style={{ color: "var(--accent)", borderColor: "var(--accent-soft)", flexShrink: 0 }}>
          practice →
        </Link>
      </div>
    </div>
  );
}

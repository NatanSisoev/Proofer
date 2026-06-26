import nextDynamic from "next/dynamic";
import Link from "next/link";
import { browseAreas, nodesInArea, nodeTypes, areaMastery, searchWithMastery } from "@/lib/queries";
import type { BrowseNode } from "@/lib/queries";
import { ArrowLeft, ArrowRight, Search } from "@/app/components/Icons";
import EmptyState from "@/app/components/EmptyState";
import BrowseFilters from "@/app/components/BrowseFilters";
import ExploreViewMode from "@/app/components/ExploreViewMode";
import ExploreSearch from "@/app/components/ExploreSearch";

const GlobalGraph = nextDynamic(() => import("@/app/components/GlobalGraph"), {
  loading: () => <div className="graph-shell graph-shell-loading" />,
});

export const revalidate = 30;

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

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: "sections" | "map" | "list";
    area?: string;
    type?: string;
    sort?: string;
    q?: string;
  }>;
}) {
  const { view = "sections", area, type, sort, q } = await searchParams;

  // Sections view (default)
  if (view === "sections") {
    return (
      <SectionsView area={area} type={type} sort={sort} />
    );
  }

  // Map view
  if (view === "map") {
    return (
      <MapView area={area} />
    );
  }

  // List view
  if (view === "list") {
    return (
      <ListView q={q} type={type} sort={sort} />
    );
  }

  // Default fallback
  return <SectionsView />;
}

async function SectionsView({
  area,
  type,
  sort,
}: {
  area?: string;
  type?: string;
  sort?: string;
}) {
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
          <Link href="/explore" className="icon-label"><ArrowLeft size={12} /> Explore</Link> · <strong>{area}</strong>
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
            className="cta icon-label"
            style={{ flexShrink: 0 }}
          >
            Practice {area} <ArrowRight size={13} />
          </Link>
        </div>

        <BrowseFilters area={area} activeType={type} activeSort={sort || "mastery_asc"} types={types} />

        <div className="node-list">
          {nodes.map((n) => (
            <NodeRow key={n.id} node={n} />
          ))}
          {nodes.length === 0 && <EmptyState icon={<Search size={18} />}>No concepts match this filter.</EmptyState>}
        </div>
      </div>
    );
  }

  // Areas list view
  const areas = browseAreas();
  return (
    <div className="wrap">
      <div className="page-top">
        <div>
          <h1>Explore by Topic</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            {areas.length} topics · click any to see concepts sorted by your mastery
          </p>
        </div>
        <ExploreViewMode currentView="sections" />
      </div>

      <div className="area-grid">
        {areas.map((a) => (
          <Link key={a.area} href={`/explore?view=sections&area=${encodeURIComponent(a.area)}`} className="area-card">
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

async function MapView({ area }: { area?: string }) {
  return (
    <div className="wrap graph-canvas">
      <div className="graph-header">
        <div>
          <h1 style={{ fontSize: 22 }}>Knowledge Map</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            Your entire graph, colored by mastery. Larger nodes unlock more concepts.
          </p>
        </div>
        <ExploreViewMode currentView="map" />
      </div>
      <div style={{ flex: 1 }}>
        <GlobalGraph initialArea={area} />
      </div>
    </div>
  );
}

async function ListView({
  q,
  type,
  sort,
}: {
  q?: string;
  type?: string;
  sort?: string;
}) {
  const validSort = (sort === "mastery_desc" || sort === "alpha") ? sort : "mastery_asc";
  let nodes: BrowseNode[] = [];

  if (q) {
    // Use the search function to find matching nodes
    nodes = searchWithMastery(q);
  } else {
    // Show all nodes if no query
    const areas = browseAreas();
    for (const area of areas) {
      const areaNodes = nodesInArea(area.area, { type, sort: validSort as any });
      nodes.push(...areaNodes);
    }
  }

  // Filter by type if specified
  if (type) {
    nodes = nodes.filter((n) => n.type === type);
  }

  // Sort
  if (validSort === "mastery_desc") {
    nodes.sort((a, b) => b.mastery_p - a.mastery_p);
  } else if (validSort === "alpha") {
    nodes.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    nodes.sort((a, b) => a.mastery_p - b.mastery_p);
  }

  const types = nodeTypes();

  return (
    <div className="wrap">
      <div className="page-top">
        <div>
          <h1>Search & Filter</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            {nodes.length} concept{nodes.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <ExploreViewMode currentView="list" />
      </div>

      <div className="search-container" style={{ marginBottom: 20 }}>
        <ExploreSearch defaultValue={q} />
      </div>

      {q && (
        <div style={{ marginBottom: 20 }}>
          <div className="filter-group">
            {(["mastery_asc", "mastery_desc", "alpha"] as const).map((s) => {
              const label = {
                mastery_asc: "Weakest first",
                mastery_desc: "Strongest first",
                alpha: "A–Z",
              }[s];
              return (
                <Link
                  key={s}
                  href={`/explore?view=list&q=${encodeURIComponent(q)}&sort=${s}`}
                  className={`filter-btn${sort === s ? " active" : ""}`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="node-list">
        {nodes.length === 0 ? (
          <EmptyState icon={<Search size={18} />}>
            {q ? "No concepts match your search." : "No concepts found."}
          </EmptyState>
        ) : (
          nodes.map((n) => (
            <NodeRow key={n.id} node={n} />
          ))
        )}
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
        <Link href={`/learn?node=${encodeURIComponent(node.id)}`} className="pill pill-accent icon-label" style={{ flexShrink: 0 }}>
          practice <ArrowRight size={10} />
        </Link>
      </div>
    </div>
  );
}

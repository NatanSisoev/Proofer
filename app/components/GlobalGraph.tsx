"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import cytoscape from "cytoscape";

type GNode = {
  id: string; title: string; type: string | null; area: string | null;
  mastery_p: number; dep_count: number;
};
type GEdge = { src: string; dst: string; type: string };
type Area = { area: string; c: number };

const EDGE_COLOR_VAR: Record<string, string> = {
  depends_on: "--edge-depends-on",
  generalizes: "--edge-generalizes",
  equivalent_to: "--edge-equivalent-to",
  contradicts: "--edge-contradicts",
};

function masteryColorVar(p: number): string {
  if (p < 0.2) return "--mastery-0";
  if (p < 0.5) return "--mastery-1";
  if (p < 0.8) return "--mastery-2";
  return "--mastery-3";
}

// Cytoscape's canvas renderer can't resolve CSS var() strings, so read the
// computed values from :root once and use those literal colors.
function readThemeColors() {
  const root = getComputedStyle(document.documentElement);
  const read = (v: string) => root.getPropertyValue(v).trim();
  return {
    edgeColor: Object.fromEntries(
      Object.entries(EDGE_COLOR_VAR).map(([k, v]) => [k, read(v)])
    ) as Record<string, string>,
    edgeDefault: read("--edge-default"),
    masteryColor: (p: number) => read(masteryColorVar(p)),
    graphBorder: read("--graph-border"),
    label: read("--graph-label"),
    textOutline: read("--bg"),
    selectedBorder: read("--accent"),
  };
}

type SavedPositions = Record<string, { x: number; y: number }>;

function layoutKey(area: string): string {
  return `proofer-graph-layout:${area || "all"}`;
}

function loadSavedPositions(area: string): SavedPositions | null {
  try {
    const raw = localStorage.getItem(layoutKey(area));
    return raw ? (JSON.parse(raw) as SavedPositions) : null;
  } catch {
    return null;
  }
}

function savePositions(area: string, cy: cytoscape.Core) {
  const positions: SavedPositions = {};
  cy.nodes().forEach((n) => {
    const p = n.position();
    positions[n.id()] = { x: p.x, y: p.y };
  });
  try {
    localStorage.setItem(layoutKey(area), JSON.stringify(positions));
  } catch {
    // ignore quota errors
  }
}

export default function GlobalGraph({ initialArea }: { initialArea?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [area, setArea] = useState(initialArea || "");
  const [areas, setAreas] = useState<Area[]>([]);
  const [nodeCount, setNodeCount] = useState(0);
  const [hideMastered, setHideMastered] = useState(false);
  const [minMastery, setMinMastery] = useState(0); // 0-100, show nodes below this
  const [searchQ, setSearchQ] = useState("");
  const [tooltip, setTooltip] = useState<{ title: string; mastery: number; type: string | null; x: number; y: number } | null>(null);

  const load = useCallback(async (filterArea: string) => {
    setLoading(true);
    setTooltip(null);
    const url = `/api/graph${filterArea ? `?area=${encodeURIComponent(filterArea)}` : ""}`;
    const res = await fetch(url);
    const data: { nodes: GNode[]; edges: GEdge[]; areas: Area[] } = await res.json();
    setAreas(data.areas);
    setNodeCount(data.nodes.length);

    if (!ref.current) return;

    cyRef.current?.destroy();

    const maxDep = Math.max(...data.nodes.map((n) => n.dep_count), 1);

    // Reuse the last computed layout for this area if we have positions for
    // every current node — skips the expensive cose layout on repeat visits.
    const saved = loadSavedPositions(filterArea);
    const hasFullLayout = !!saved && data.nodes.every((n) => saved[n.id]);
    const theme = readThemeColors();

    const cy = cytoscape({
      container: ref.current,
      elements: [
        ...data.nodes.map((n) => ({
          data: {
            id: n.id,
            label: n.title.length > 20 ? n.title.slice(0, 18) + "…" : n.title,
            color: theme.masteryColor(n.mastery_p),
            size: 14 + (n.dep_count / maxDep) * 22,
            mastery: n.mastery_p,
            type: n.type,
            area: n.area,
          },
        })),
        ...data.edges.map((e) => ({
          data: {
            id: `${e.src}→${e.dst}`,
            source: e.src,
            target: e.dst,
            color: theme.edgeColor[e.type] || theme.edgeDefault,
          },
        })),
      ],
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            "border-color": theme.graphBorder,
            "border-width": 1,
            label: "data(label)",
            color: theme.label,
            "font-size": 7,
            "text-valign": "bottom",
            "text-margin-y": 2,
            width: "data(size)",
            height: "data(size)",
            "text-max-width": "80px",
            "text-wrap": "ellipsis",
            "text-outline-color": theme.textOutline,
            "text-outline-width": 1,
          },
        },
        {
          selector: "node:selected",
          style: { "border-width": 2.5, "border-color": theme.selectedBorder },
        },
        {
          selector: "edge",
          style: {
            width: 0.8,
            "line-color": "data(color)",
            "target-arrow-color": "data(color)",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.5,
            "curve-style": "bezier",
            opacity: 0.6,
          },
        },
      ],
      layout: hasFullLayout
        ? ({
            name: "preset",
            positions: (node: cytoscape.NodeSingular) => saved![node.id()],
            fit: true,
            padding: 30,
          } as any)
        : ({
            name: "cose",
            animate: data.nodes.length < 300,
            animationDuration: 800,
            randomize: false,
            nodeRepulsion: () => 8000,
            idealEdgeLength: () => 60,
            gravity: 0.8,
            numIter: 500,
            padding: 30,
          } as any),
      minZoom: 0.1,
      maxZoom: 4,
      wheelSensitivity: 0.15,
    });

    cy.on("tap", "node", (evt) => {
      router.push(`/node/${encodeURIComponent(evt.target.id())}`);
    });

    cy.on("mouseover", "node", (evt) => {
      const n = evt.target;
      const pos = n.renderedPosition();
      const container = ref.current!.getBoundingClientRect();
      setTooltip({
        title: n.id(),
        mastery: n.data("mastery"),
        type: n.data("type"),
        x: pos.x + container.left,
        y: pos.y + container.top - 36,
      });
    });

    cy.on("mouseout", "node", () => setTooltip(null));

    // Persist node positions once the layout settles so the next visit to
    // this area can skip straight to "preset" instead of re-running cose.
    cy.on("layoutstop", () => savePositions(filterArea, cy));

    cyRef.current = cy;
    setLoading(false);
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply mastery + search filters whenever they change (without full reload)
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const theme = readThemeColors();
    const q = searchQ.trim().toLowerCase();
    cy.nodes().forEach((n) => {
      const m = n.data("mastery") as number;
      const masteryHide = (hideMastered && m >= 0.8) || m * 100 < minMastery;
      const matchesSearch = !q || n.id().toLowerCase().includes(q);
      const shouldHide = masteryHide || (q !== "" && !matchesSearch);
      n.style("display", shouldHide ? "none" : "element");
      // Highlight matching nodes
      if (q && matchesSearch && !masteryHide) {
        n.style({ "border-width": 2.5, "border-color": theme.selectedBorder, "font-size": 9 });
      } else {
        n.style({ "border-width": 1, "border-color": theme.graphBorder, "font-size": 7 });
      }
    });
    cy.edges().forEach((e) => {
      const srcHidden = e.source().style("display") === "none";
      const dstHidden = e.target().style("display") === "none";
      e.style("display", srcHidden || dstHidden ? "none" : "element");
    });
    // Pan to first match if query is non-empty
    if (q) {
      const first = cy.nodes().filter((n) => n.id().toLowerCase().includes(q) && n.style("display") !== "none").first();
      if (first.length) cy.animate({ center: { eles: first }, zoom: 2 } as any, { duration: 400 });
    }
  }, [hideMastered, minMastery, searchQ]);

  useEffect(() => {
    load(area);
    return () => { cyRef.current?.destroy(); cyRef.current = null; };
  }, [area, load]);

  return (
    <div className="graph-layout">
      {/* Controls */}
      <div className="graph-controls">
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Highlight node…"
          className="search-box graph-search-input"
        />
        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="filter-btn graph-area-select"
        >
          <option value="">All areas ({areas.reduce((s, a) => s + a.c, 0)} concepts)</option>
          {areas.map((a) => (
            <option key={a.area} value={a.area}>
              {a.area} ({a.c})
            </option>
          ))}
        </select>

        <label className="graph-label">
          <input
            type="checkbox"
            checked={hideMastered}
            onChange={(e) => setHideMastered(e.target.checked)}
            style={{ accentColor: "var(--accent)" }}
          />
          Hide mastered
        </label>

        <label className="graph-label">
          Min mastery:
          <input
            type="range"
            min={0}
            max={80}
            step={10}
            value={minMastery}
            onChange={(e) => setMinMastery(Number(e.target.value))}
            className="graph-range"
          />
          <span style={{ width: 32 }}>{minMastery}%</span>
        </label>

        {!loading && <span className="muted small">{nodeCount} nodes · click to navigate · scroll to zoom</span>}
        {loading && <span className="muted small">Laying out graph…</span>}
      </div>

      {/* Legend */}
      <div className="legend-row">
        {[
          { label: "Not practiced", color: "var(--mastery-0)" },
          { label: "Learning", color: "var(--mastery-1)" },
          { label: "Partially known", color: "var(--mastery-2)" },
          { label: "Mastered", color: "var(--mastery-3)" },
        ].map((l) => (
          <div key={l.label} className="legend-item">
            <div className="legend-dot" style={{ background: l.color }} />
            <span className="small muted">{l.label}</span>
          </div>
        ))}
        <div className="legend-item">
          <div className="edge-legend-sample" />
          <span className="small muted">depends on</span>
        </div>
      </div>

      {/* Graph */}
      <div ref={ref} className="graph-canvas" />

      {/* Tooltip */}
      {tooltip && (
        <div className="graph-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <strong>{tooltip.title}</strong>
          {tooltip.type && <span className="muted"> · {tooltip.type}</span>}
          <span style={{ marginLeft: 8, color: tooltip.mastery >= 0.8 ? "var(--green)" : tooltip.mastery > 0 ? "var(--amber)" : "var(--muted)" }}>
            {Math.round(tooltip.mastery * 100)}% mastery
          </span>
        </div>
      )}
    </div>
  );
}

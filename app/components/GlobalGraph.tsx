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

const EDGE_COLOR: Record<string, string> = {
  depends_on: "#2a4a7a",
  generalizes: "#3a2a5a",
  equivalent_to: "#1a3a2a",
  contradicts: "#5a1a1a",
};

function masteryColor(p: number): string {
  // 0 = dark red, 0.5 = amber, 1 = green
  if (p <= 0) return "#2a1a1a";
  if (p < 0.4) return `hsl(${Math.round(p * 60)}, 70%, 28%)`;
  if (p < 0.8) return `hsl(${Math.round(40 + p * 40)}, 75%, 32%)`;
  return `hsl(${Math.round(140 - (p - 0.8) * 20)}, 65%, 35%)`;
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

    const cy = cytoscape({
      container: ref.current,
      elements: [
        ...data.nodes.map((n) => ({
          data: {
            id: n.id,
            label: n.title.length > 20 ? n.title.slice(0, 18) + "…" : n.title,
            color: masteryColor(n.mastery_p),
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
            color: EDGE_COLOR[e.type] || "#1a2a3a",
          },
        })),
      ],
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            "border-color": "#4a6a9a",
            "border-width": 0,
            label: "data(label)",
            color: "#c8d8f0",
            "font-size": 7,
            "text-valign": "bottom",
            "text-margin-y": 2,
            width: "data(size)",
            height: "data(size)",
            "text-max-width": "80px",
            "text-wrap": "ellipsis",
            "text-outline-color": "#0b0e14",
            "text-outline-width": 1,
          },
        },
        {
          selector: "node:selected",
          style: { "border-width": 2.5, "border-color": "#6ea8fe" },
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
      layout: {
        name: "cose",
        animate: data.nodes.length < 300,
        animationDuration: 800,
        randomize: false,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 60,
        gravity: 0.8,
        numIter: 500,
        padding: 30,
      } as any,
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

    cyRef.current = cy;
    setLoading(false);
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply mastery filter whenever it changes (without full reload)
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().forEach((n) => {
      const m = n.data("mastery") as number;
      const shouldHide = (hideMastered && m >= 0.8) || m * 100 < minMastery;
      n.style("display", shouldHide ? "none" : "element");
    });
    cy.edges().forEach((e) => {
      const srcHidden = e.source().style("display") === "none";
      const dstHidden = e.target().style("display") === "none";
      e.style("display", srcHidden || dstHidden ? "none" : "element");
    });
  }, [hideMastered, minMastery]);

  useEffect(() => {
    load(area);
    return () => { cyRef.current?.destroy(); cyRef.current = null; };
  }, [area, load]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="filter-btn"
          style={{ fontSize: 13, padding: "5px 12px", cursor: "pointer" }}
        >
          <option value="">All areas ({areas.reduce((s, a) => s + a.c, 0)} concepts)</option>
          {areas.map((a) => (
            <option key={a.area} value={a.area}>
              {a.area} ({a.c})
            </option>
          ))}
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={hideMastered}
            onChange={(e) => setHideMastered(e.target.checked)}
            style={{ accentColor: "var(--accent)" }}
          />
          Hide mastered
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)" }}>
          Min mastery:
          <input
            type="range"
            min={0}
            max={80}
            step={10}
            value={minMastery}
            onChange={(e) => setMinMastery(Number(e.target.value))}
            style={{ width: 80, accentColor: "var(--accent)" }}
          />
          <span style={{ width: 32 }}>{minMastery}%</span>
        </label>

        {!loading && <span className="muted small">{nodeCount} nodes · click to navigate · scroll to zoom</span>}
        {loading && <span className="muted small">Laying out graph…</span>}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        {[
          { label: "Not practiced", color: "#2a1a1a" },
          { label: "Learning", color: "#5a3a1a" },
          { label: "Partially known", color: "#4a4a1a" },
          { label: "Mastered", color: "#1a4a2a" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: l.color }} />
            <span className="small muted">{l.label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 20, height: 8, borderRadius: 4, background: "#1a2a3a", border: "1px solid #2a4a7a" }} />
          <span className="small muted">depends on</span>
        </div>
      </div>

      {/* Graph */}
      <div ref={ref} style={{
        flex: 1, minHeight: 500,
        background: "var(--bg-soft)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        position: "relative",
      }} />

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: "fixed",
          left: tooltip.x,
          top: tooltip.y,
          transform: "translateX(-50%)",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "6px 12px",
          fontSize: 12.5,
          pointerEvents: "none",
          zIndex: 200,
          whiteSpace: "nowrap",
        }}>
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

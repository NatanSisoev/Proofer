"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import cytoscape from "cytoscape";

type PG = {
  center: string;
  nodes: { id: string; title: string; type: string | null; exists_: number; mastery_p: number; depth: number }[];
  edges: { src: string; dst: string }[];
};

// Cytoscape's canvas renderer can't resolve CSS var() strings, so read the
// computed theme colors from :root at mount (same pattern as EgoGraph).
function readColors() {
  const root = getComputedStyle(document.documentElement);
  const read = (v: string) => root.getPropertyValue(v).trim();
  return {
    mastered: read("--green"),
    partial: read("--amber"),
    unstarted: read("--mastery-0"),
    ghost: read("--node-ghost"),
    center: read("--accent"),
    edge: read("--edge-depends-on"),
    label: read("--graph-label"),
  };
}

/**
 * A prerequisite DAG for one concept: the target at the top, the concepts it
 * depends on cascading below (foundations at the bottom). Nodes are colored by
 * mastery so the learning progression — what to shore up first — is visible at a
 * glance. Built on cytoscape's directed breadthfirst layout.
 */
export default function PrereqGraph({ data }: { data: PG }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!ref.current) return;
    const c = readColors();
    const fill = (p: number, exists: number) =>
      exists === 0 ? c.ghost : p >= 0.8 ? c.mastered : p > 0 ? c.partial : c.unstarted;

    const cy = cytoscape({
      container: ref.current,
      elements: [
        ...data.nodes.map((n) => ({
          data: {
            id: n.id,
            label: n.title.length > 24 ? n.title.slice(0, 22) + "…" : n.title,
            color: fill(n.mastery_p, n.exists_),
            isCenter: n.id === data.center ? 1 : 0,
          },
        })),
        ...data.edges.map((e) => ({
          data: { id: `${e.src}->${e.dst}`, source: e.src, target: e.dst },
        })),
      ],
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            label: "data(label)",
            color: c.label,
            "font-size": 9,
            "text-valign": "bottom",
            "text-margin-y": 3,
            width: 16,
            height: 16,
            "text-max-width": "100px",
            "text-wrap": "ellipsis",
            "border-color": c.center,
            "border-width": 0,
          },
        },
        {
          selector: "node[isCenter = 1]",
          style: { width: 26, height: 26, "font-size": 11, "font-weight": "bold", "border-width": 3 },
        },
        {
          selector: "edge",
          style: {
            width: 1.4,
            "line-color": c.edge,
            "target-arrow-color": c.edge,
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.7,
            "curve-style": "bezier",
            opacity: 0.8,
          },
        },
      ],
      minZoom: 0.3,
      maxZoom: 2.5,
      wheelSensitivity: 0.2,
    });

    // roots = the target concept; directed breadthfirst then cascades each
    // depended-on concept into the layer below it.
    cy.layout({
      name: "breadthfirst",
      directed: true,
      roots: cy.nodes("[isCenter = 1]"),
      spacingFactor: 1.05,
      padding: 24,
    } as any).run();
    cy.fit(undefined, 26);

    cy.on("tap", "node", (evt) => {
      const id = evt.target.id();
      if (id !== data.center) router.push(`/node/${encodeURIComponent(id)}`);
    });

    return () => cy.destroy();
  }, [data, router]);

  return (
    <div className="graph-shell">
      <div ref={ref} className="graph-fill" />
      <div className="graph-legend">
        <span style={{ color: "var(--green)" }}>mastered</span>
        <span style={{ color: "var(--amber)" }}>in progress</span>
        <span style={{ color: "var(--muted)" }}>not started</span>
      </div>
    </div>
  );
}

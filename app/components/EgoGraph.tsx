"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import cytoscape from "cytoscape";

type Ego = {
  center: string;
  nodes: { id: string; title: string; type: string | null; exists_: number; known: number }[];
  edges: { src: string; dst: string; type: string; confidence: number }[];
};

// Map edge/node type keys to CSS variable names. The variables are defined in
// globals.css for both light and dark mode. Cytoscape's canvas renderer cannot
// resolve CSS var() strings directly, so we read the computed values from :root
// at mount time (same pattern as GlobalGraph.tsx).
const EDGE_COLOR_VAR: Record<string, string> = {
  depends_on:    "--edge-depends-on",
  generalizes:   "--edge-generalizes",
  equivalent_to: "--edge-equivalent-to",
  instance_of:   "--edge-instance-of",
  contradicts:   "--edge-contradicts",
  related:       "--edge-default",
};

const TYPE_COLOR_VAR: Record<string, string> = {
  Definition:  "--node-definition",
  Theorem:     "--node-theorem",
  Proposition: "--node-theorem",
  Lemma:       "--node-theorem",
  Corollary:   "--node-theorem",
  Algorithm:   "--node-algorithm",
  Example:     "--node-example",
};

function readThemeColors() {
  const root = getComputedStyle(document.documentElement);
  const read = (v: string) => root.getPropertyValue(v).trim();
  return {
    edgeColor: Object.fromEntries(
      Object.entries(EDGE_COLOR_VAR).map(([k, v]) => [k, read(v)])
    ) as Record<string, string>,
    typeColor: Object.fromEntries(
      Object.entries(TYPE_COLOR_VAR).map(([k, v]) => [k, read(v)])
    ) as Record<string, string>,
    edgeDefault:  read("--edge-default"),
    nodeDefault:  read("--node-default"),
    nodeGhost:    read("--node-ghost"),
    centerBorder: read("--accent"),
    knownBorder:  read("--green"),
    label:        read("--graph-label"),
  };
}

export default function EgoGraph({
  slug,
  depth = 1,
  initialData,
}: {
  slug: string;
  depth?: number;
  initialData?: Ego;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let cy: cytoscape.Core | undefined;
    let cancelled = false;
    (async () => {
      const data: Ego = initialData ?? (await (await fetch(`/api/ego/${encodeURIComponent(slug)}?depth=${depth}`)).json());
      if (cancelled || !ref.current) return;

      const theme = readThemeColors();

      cy = cytoscape({
        container: ref.current,
        elements: [
          ...data.nodes.map((n) => ({
            data: {
              id: n.id,
              label: n.title.length > 26 ? n.title.slice(0, 24) + "…" : n.title,
              color: n.exists_ === 0 ? theme.nodeGhost : theme.typeColor[n.type || ""] || theme.nodeDefault,
              border: n.id === data.center ? theme.centerBorder : n.known ? theme.knownBorder : "transparent",
              bw: n.id === data.center ? 3 : n.known ? 2.5 : 0,
              isCenter: n.id === data.center ? 1 : 0,
            },
          })),
          ...data.edges.map((e) => ({
            data: { id: `${e.src}->${e.dst}-${e.type}`, source: e.src, target: e.dst, color: theme.edgeColor[e.type] || theme.edgeDefault },
          })),
        ],
        style: [
          {
            selector: "node",
            style: {
              "background-color": "data(color)",
              "border-color": "data(border)",
              "border-width": "data(bw)",
              label: "data(label)",
              color: theme.label,
              "font-size": 9,
              "text-valign": "bottom",
              "text-margin-y": 3,
              width: 18,
              height: 18,
              "text-max-width": "90px",
              "text-wrap": "ellipsis",
            },
          },
          { selector: "node[isCenter = 1]", style: { width: 28, height: 28, "font-size": 11, "font-weight": "bold" } },
          {
            selector: "edge",
            style: {
              width: 1.4,
              "line-color": "data(color)",
              "target-arrow-color": "data(color)",
              "target-arrow-shape": "triangle",
              "arrow-scale": 0.7,
              "curve-style": "bezier",
              opacity: 0.7,
            },
          },
        ],
        layout: { name: "concentric", concentric: (n: any) => (n.data("isCenter") ? 10 : 1), levelWidth: () => 1, minNodeSpacing: 28, padding: 24 },
        minZoom: 0.3,
        maxZoom: 2.5,
        wheelSensitivity: 0.2,
      });

      cy.on("tap", "node", (evt) => {
        const id = evt.target.id();
        if (id !== data.center) router.push(`/node/${encodeURIComponent(id)}`);
      });
    })();
    return () => {
      cancelled = true;
      cy?.destroy();
    };
  }, [slug, depth, initialData, router]);

  return (
    <div className="graph-shell">
      <div ref={ref} className="graph-fill" />
      <div className="graph-legend">
        <span style={{ color: "var(--accent)" }}>depends on</span>
        <span style={{ color: "var(--purple)" }}>generalizes</span>
        <span style={{ color: "var(--green)" }}>equivalent</span>
        <span style={{ color: "var(--muted)" }}>related</span>
      </div>
    </div>
  );
}

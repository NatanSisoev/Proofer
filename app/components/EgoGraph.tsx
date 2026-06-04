"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import cytoscape from "cytoscape";

type Ego = {
  center: string;
  nodes: { id: string; title: string; type: string | null; exists_: number; known: number }[];
  edges: { src: string; dst: string; type: string; confidence: number }[];
};

const EDGE_COLOR: Record<string, string> = {
  depends_on: "#6ea8fe",
  generalizes: "#b794f6",
  equivalent_to: "#57d9a3",
  instance_of: "#f2c94c",
  contradicts: "#ff6b6b",
  related: "#3a465c",
};

const TYPE_COLOR: Record<string, string> = {
  Definition: "#2b6cb0",
  Theorem: "#6b46c1",
  Proposition: "#6b46c1",
  Lemma: "#6b46c1",
  Corollary: "#6b46c1",
  Algorithm: "#2f855a",
  Example: "#b7791f",
};

export default function EgoGraph({ slug, depth = 1 }: { slug: string; depth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let cy: cytoscape.Core | undefined;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/ego/${encodeURIComponent(slug)}?depth=${depth}`);
      const data: Ego = await res.json();
      if (cancelled || !ref.current) return;

      cy = cytoscape({
        container: ref.current,
        elements: [
          ...data.nodes.map((n) => ({
            data: {
              id: n.id,
              label: n.title.length > 26 ? n.title.slice(0, 24) + "…" : n.title,
              color: n.exists_ === 0 ? "#5a2a2a" : TYPE_COLOR[n.type || ""] || "#37445c",
              border: n.id === data.center ? "#ffffff" : n.known ? "#57d9a3" : "transparent",
              bw: n.id === data.center ? 3 : n.known ? 2.5 : 0,
              isCenter: n.id === data.center ? 1 : 0,
            },
          })),
          ...data.edges.map((e) => ({
            data: { id: `${e.src}->${e.dst}-${e.type}`, source: e.src, target: e.dst, color: EDGE_COLOR[e.type] || "#33415a" },
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
              color: "#d6deeb",
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
  }, [slug, depth, router]);

  return (
    <div className="graph-shell">
      <div ref={ref} style={{ width: "100%", height: "100%" }} />
      <div className="graph-legend">
        <span style={{ color: "#6ea8fe" }}>depends on</span>
        <span style={{ color: "#b794f6" }}>generalizes</span>
        <span style={{ color: "#57d9a3" }}>equivalent</span>
        <span style={{ color: "#8a99b3" }}>related</span>
      </div>
    </div>
  );
}

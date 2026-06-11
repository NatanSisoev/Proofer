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
  depends_on: "#C9CDD8",
  generalizes: "#D8D0E8",
  equivalent_to: "#CFE0D5",
  instance_of: "#F0E4C5",
  contradicts: "#E8D0D0",
  related: "#D0D0CC",
};

const TYPE_COLOR: Record<string, string> = {
  Definition: "#C5D4E8",
  Theorem: "#D8D0E8",
  Proposition: "#D8D0E8",
  Lemma: "#D8D0E8",
  Corollary: "#D8D0E8",
  Algorithm: "#C5DCC0",
  Example: "#F0E4C5",
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
              color: n.exists_ === 0 ? "#F5E8E8" : TYPE_COLOR[n.type || ""] || "#E8E8E4",
              border: n.id === data.center ? "#5B6B9A" : n.known ? "#3D6B4F" : "transparent",
              bw: n.id === data.center ? 3 : n.known ? 2.5 : 0,
              isCenter: n.id === data.center ? 1 : 0,
            },
          })),
          ...data.edges.map((e) => ({
            data: { id: `${e.src}->${e.dst}-${e.type}`, source: e.src, target: e.dst, color: EDGE_COLOR[e.type] || "#D0D0CC" },
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
              color: "#374151",
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
        <span style={{ color: "var(--accent)" }}>depends on</span>
        <span style={{ color: "var(--purple)" }}>generalizes</span>
        <span style={{ color: "var(--green)" }}>equivalent</span>
        <span style={{ color: "var(--muted)" }}>related</span>
      </div>
    </div>
  );
}

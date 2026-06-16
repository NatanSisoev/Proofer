import Link from "next/link";
import { learningPath } from "@/lib/queries";
import type { BrowseNode } from "@/lib/queries";

export default function LearningPath({ nodeId }: { nodeId: string }) {
  const path = learningPath(nodeId);
  if (path.length === 0) return null;

  const show = path.slice(0, 12);
  const extra = path.length - show.length;

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-header">
        <h2>Learning path — {path.length} unmastered prerequisite{path.length !== 1 ? "s" : ""}</h2>
        <span className="muted small">foundations first</span>
      </div>
      <p className="muted small" style={{ marginTop: -4, marginBottom: 10 }}>
        Master these in order to be fully ready for this concept.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {show.map((n, i) => (
          <div key={n.id} className="path-row">
            <span className="path-num muted small">{i + 1}</span>
            {n.type && <span className={`type-badge t-${n.type}`}>{n.type}</span>}
            <Link href={`/node/${encodeURIComponent(n.id)}`} style={{ flex: 1, fontSize: 13.5 }}>
              {n.title}
            </Link>
            <div className="bar" style={{ width: 56 }}>
              <span style={{ width: `${Math.round((n as any).mastery_p * 100)}%` }} />
            </div>
            <span className="small muted" style={{ width: 32, textAlign: "right" }}>
              {Math.round((n as any).mastery_p * 100)}%
            </span>
            <Link
              href={`/learn?node=${encodeURIComponent(n.id)}`}
              className="pill"
              style={{ color: "var(--accent)", borderColor: "var(--accent-soft)", flexShrink: 0 }}
            >
              drill →
            </Link>
          </div>
        ))}
      </div>
      {extra > 0 && (
        <p className="muted small" style={{ marginTop: 8 }}>
          …and {extra} more. <Link href={`/browse?area=${encodeURIComponent("")}`}>Browse all prerequisites</Link>
        </p>
      )}
    </div>
  );
}

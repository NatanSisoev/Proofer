import Link from "next/link";
import { learningPath } from "@/lib/queries";

export default function LearningPath({ nodeId }: { nodeId: string }) {
  const path = learningPath(nodeId);
  if (path.length === 0) return null;

  const show = path.slice(0, 12);
  const extra = path.length - show.length;
  const sessionIds = path.slice(0, 10).map((n) => encodeURIComponent(n.id)).join(",");

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-header">
        <h2>Learning path — {path.length} unmastered prerequisite{path.length !== 1 ? "s" : ""}</h2>
        <Link
          href={`/session?mode=custom&nodes=${sessionIds}`}
          className="pill pill-accent"
        >
          Practice all →
        </Link>
      </div>
      <p className="muted small path-subtitle">
        Master these in order to be fully ready for this concept.
      </p>
      <div className="path-list">
        {show.map((n, i) => (
          <div key={n.id} className="path-row">
            <span className="path-num muted small">{i + 1}</span>
            {n.type && <span className={`type-badge t-${n.type}`}>{n.type}</span>}
            <Link href={`/node/${encodeURIComponent(n.id)}`} className="path-link">
              {n.title}
            </Link>
            <div className="bar" style={{ width: 56 }}>
              <span style={{ width: `${Math.round((n as any).mastery_p * 100)}%` }} />
            </div>
            <span className="small muted pct-label">
              {Math.round((n as any).mastery_p * 100)}%
            </span>
            <Link
              href={`/learn?node=${encodeURIComponent(n.id)}`}
              className="pill pill-accent"
              style={{ flexShrink: 0 }}
            >
              drill →
            </Link>
          </div>
        ))}
      </div>
      {extra > 0 && (
        <p className="muted small" style={{ marginTop: 8 }}>
          …and {extra} more.
        </p>
      )}
    </div>
  );
}

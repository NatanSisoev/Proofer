import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "@/app/components/Markdown";
import EgoGraph from "@/app/components/EgoGraph";
import KnownButton from "@/app/components/KnownButton";
import { getNode, edgesOf, isKnown, readiness, prerequisites } from "@/lib/queries";
import type { EdgeRow } from "@/lib/db";

export const dynamic = "force-dynamic";

const EDGE_LABEL: Record<string, string> = {
  depends_on: "depends on",
  generalizes: "generalizes",
  equivalent_to: "equivalent to",
  instance_of: "instance of",
  contradicts: "contradicts",
  related: "related to",
};
const INV_LABEL: Record<string, string> = {
  depends_on: "required for",
  generalizes: "specializes",
  equivalent_to: "equivalent to",
  instance_of: "has instance",
  contradicts: "contradicted by",
  related: "related to",
};

function RelList({ rows, dir }: { rows: EdgeRow[]; dir: "out" | "in" }) {
  if (rows.length === 0) return <p className="muted small">None.</p>;
  return (
    <ul className="rel-list">
      {rows.map((e, i) => {
        const other = dir === "out" ? e.dst : e.src;
        const label = dir === "out" ? EDGE_LABEL[e.type] : INV_LABEL[e.type];
        return (
          <li key={i}>
            <span className={`edge-type ${e.type}`}>{label}</span>
            <Link href={`/node/${encodeURIComponent(other)}`}>{other}</Link>
            {e.context && <span className="edge-ctx">— {e.context.replace(/\*\*/g, "")}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export default async function NodePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = decodeURIComponent(slug);
  const node = getNode(id);
  if (!node) notFound();

  const { outgoing, incoming } = edgesOf(id);
  const known = isKnown(id);
  const ready = readiness(id);
  const { depth } = prerequisites(id);

  // group outgoing by semantic priority
  const order = ["depends_on", "generalizes", "equivalent_to", "instance_of", "contradicts", "related"];
  const sortByType = (a: EdgeRow, b: EdgeRow) => order.indexOf(a.type) - order.indexOf(b.type);
  outgoing.sort(sortByType);
  incoming.sort(sortByType);

  return (
    <div className="wrap">
      <div className="breadcrumb">
        <Link href="/">← map</Link>
        {node.area && <> · {node.area}</>}
      </div>

      {node.exists_ === 0 ? (
        <>
          <div className="node-head">
            <div>
              <span className="type-badge t-ghost">gap</span>
              <h1 style={{ marginTop: 8 }}>{node.title}</h1>
            </div>
          </div>
          <p className="muted">
            This concept is referenced by other notes but doesn&apos;t exist yet — a gap in the graph.
            {incoming.length > 0 && ` ${incoming.length} concept(s) point here.`}
          </p>
          <div className="panel" style={{ marginTop: 20 }}>
            <h2>Referenced by</h2>
            <RelList rows={incoming} dir="in" />
          </div>
        </>
      ) : (
        <>
          <div className="node-head">
            <div>
              {node.type && <span className={`type-badge t-${node.type}`}>{node.type}</span>}
              <h1 style={{ marginTop: 8 }}>{node.title}</h1>
              {node.overview && <p className="muted" style={{ marginTop: -2, maxWidth: 640 }}>{node.overview}</p>}
            </div>
            <KnownButton slug={id} initial={known} />
          </div>

          {ready.total > 0 && (
            <div className="readiness panel">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <strong>Readiness {Math.round(ready.score * 100)}%</strong>
                <span className="muted small">
                  {ready.known}/{ready.total} prerequisites known · dependency depth {depth}
                </span>
              </div>
              <div className="bar"><span style={{ width: `${Math.round(ready.score * 100)}%` }} /></div>
              {ready.missing.length > 0 && (
                <p className="muted small" style={{ marginTop: 10 }}>
                  Still need:{" "}
                  {ready.missing.slice(0, 8).map((m, i) => (
                    <span key={m.id}>
                      {i > 0 && ", "}
                      <Link href={`/node/${encodeURIComponent(m.id)}`}>{m.title}</Link>
                    </span>
                  ))}
                  {ready.missing.length > 8 && ` and ${ready.missing.length - 8} more`}
                </p>
              )}
            </div>
          )}

          <div className="grid" style={{ marginTop: 20 }}>
            <div>
              {node.content && <Markdown>{node.content}</Markdown>}
            </div>
            <div>
              <div className="panel" style={{ marginBottom: 16 }}>
                <h2>Neighborhood</h2>
                <EgoGraph slug={id} depth={1} />
              </div>
              <div className="panel" style={{ marginBottom: 16 }}>
                <h2>Outgoing</h2>
                <RelList rows={outgoing} dir="out" />
              </div>
              <div className="panel">
                <h2>Incoming</h2>
                <RelList rows={incoming} dir="in" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

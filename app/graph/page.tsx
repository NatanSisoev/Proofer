import GlobalGraph from "@/app/components/GlobalGraph";
import Link from "next/link";

export default async function GraphPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  const { area } = await searchParams;

  return (
    <div className="wrap graph-canvas">
      <div className="graph-header">
        <div>
          <h1 style={{ fontSize: 22 }}>Knowledge Map</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            Your entire graph, colored by mastery. Larger nodes unlock more concepts.
          </p>
        </div>
        <Link href="/" className="muted small">← home</Link>
      </div>
      <div style={{ flex: 1 }}>
        <GlobalGraph initialArea={area} />
      </div>
    </div>
  );
}

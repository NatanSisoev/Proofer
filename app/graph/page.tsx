import nextDynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "@/app/components/Icons";

// cytoscape is a heavy client-only lib; defer it to its own chunk so it
// doesn't bloat the JS this navigation has to download and parse.
const GlobalGraph = nextDynamic(() => import("@/app/components/GlobalGraph"), {
  loading: () => <div className="graph-shell graph-shell-loading" />,
});

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
        <Link href="/" className="muted small icon-label"><ArrowLeft size={12} /> home</Link>
      </div>
      <div style={{ flex: 1 }}>
        <GlobalGraph initialArea={area} />
      </div>
    </div>
  );
}

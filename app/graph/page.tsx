import GlobalGraph from "@/app/components/GlobalGraph";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function GraphPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  const { area } = await searchParams;

  return (
    <div className="wrap" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 48px)", paddingBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, letterSpacing: "-0.02em" }}>Knowledge Map</h1>
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

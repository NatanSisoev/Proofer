import { browseAreas } from "@/lib/queries";
import SessionSetup from "@/app/components/SessionSetup";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; area?: string }>;
}) {
  const { mode, area } = await searchParams;
  const areas = browseAreas().map((a) => a.area);
  return (
    <div className="wrap">
      <header className="top">
        <h1>Study session</h1>
        <span className="tag">focused practice on a queue of concepts</span>
      </header>
      <SessionSetup areas={areas} initialMode={(mode as any) || "smart"} initialArea={area || ""} />
    </div>
  );
}

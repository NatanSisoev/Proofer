import Link from "next/link";
import StudyPlanClient from "./StudyPlanClient";
import { browseAreas, areaMastery } from "@/lib/queries";
import { HAS_KEY } from "@/lib/llm";

export const dynamic = "force-dynamic";

export default function StudyPlanPage() {
  const areas = browseAreas().sort((a, b) => b.count - a.count).map(a => a.area);
  const areaStats = areaMastery()
    .filter(a => a.total > 0)
    .sort((a, b) => a.avg_p - b.avg_p);

  return (
    <div className="wrap">
      <div className="breadcrumb">
        <Link href="/">← home</Link>
      </div>
      <header className="top" style={{ borderBottom: "none" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, letterSpacing: "-0.02em" }}>📅 Study Plan</h1>
          <p className="tag" style={{ marginTop: 4, fontSize: 14 }}>
            AI-generated schedule tailored to your current mastery
          </p>
        </div>
      </header>

      {!HAS_KEY ? (
        <div className="panel" style={{ marginTop: 20 }}>
          <p className="muted">No LLM API key configured. Add <code>GEMINI_API_KEY</code> to <code>.env.local</code> to use this feature.</p>
        </div>
      ) : (
        <StudyPlanClient areas={areas} areaStats={areaStats} />
      )}
    </div>
  );
}

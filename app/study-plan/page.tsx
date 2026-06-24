import Link from "next/link";
import StudyPlanClient from "./StudyPlanClient";
import { browseAreas, areaMastery } from "@/lib/queries";
import { hasKey } from "@/lib/llm";
import ProgressTabs from "@/app/components/ProgressTabs";

export const dynamic = "force-dynamic";

export default function StudyPlanPage() {
  const areas = browseAreas().sort((a, b) => b.count - a.count).map(a => a.area);
  const areaStats = areaMastery()
    .filter(a => a.total > 0)
    .sort((a, b) => a.avg_p - b.avg_p);

  return (
    <div className="wrap">
      <header className="top borderless">
        <div>
          <h1>Study Plan</h1>
          <p className="tag">
            AI-generated schedule tailored to your current mastery
          </p>
        </div>
      </header>

      <ProgressTabs active="plan" />

      {!hasKey() ? (
        <div className="panel" style={{ marginTop: 20 }}>
          <p className="muted">No LLM API key configured. Add one in <Link href="/settings">Settings</Link>, or set <code>GEMINI_API_KEY</code> in <code>.env.local</code>.</p>
        </div>
      ) : (
        <StudyPlanClient areas={areas} areaStats={areaStats} />
      )}
    </div>
  );
}

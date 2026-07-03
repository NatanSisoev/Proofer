import Link from "next/link";
import { redirect } from "next/navigation";
import { getLearningGoal } from "@/lib/settings";
import { ArrowRight } from "@/app/components/Icons";

export const dynamic = "force-dynamic";

export default async function PathIndexPage() {
  const goalId = getLearningGoal();
  if (goalId) redirect(`/path/${encodeURIComponent(goalId)}`);

  return (
    <div className="wrap">
      <h1>Guided path</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        Set a Learning Goal on any concept's page to get a guided, gated lane toward it —
        or open a specific concept and click &ldquo;Start guided path&rdquo; from its learning path panel.
      </p>
      <Link href="/explore?view=sections" className="cta icon-label" style={{ marginTop: 16 }}>
        Browse concepts <ArrowRight size={13} />
      </Link>
    </div>
  );
}

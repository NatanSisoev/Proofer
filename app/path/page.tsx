import Link from "next/link";
import { redirect } from "next/navigation";
import { getLearningGoal } from "@/lib/settings";
import { ArrowRight, Sparkles } from "@/app/components/Icons";
import EmptyState from "@/app/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function PathIndexPage() {
  const goalId = getLearningGoal();
  if (goalId) redirect(`/path/${encodeURIComponent(goalId)}`);

  return (
    <div className="wrap">
      <div className="page-top">
        <div>
          <h1>Guided path</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            A guided, gated lane toward any concept you&rsquo;re aiming for.
          </p>
        </div>
      </div>
      <EmptyState icon={<Sparkles size={18} />}>
        Set a Learning Goal on any concept&rsquo;s page to get a guided, gated lane toward it —
        or open a specific concept and click &ldquo;Start guided path&rdquo; from its learning path panel.
      </EmptyState>
      <div style={{ textAlign: "center", marginTop: -8 }}>
        <Link href="/explore?view=sections" className="cta icon-label">
          Browse concepts <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}

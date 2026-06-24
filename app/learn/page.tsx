import { redirect } from "next/navigation";
import Link from "next/link";
import StudyQueue from "@/app/components/StudyQueue";
import { getNode } from "@/lib/queries";
import { getCalibrationEnabled } from "@/lib/settings";
import { ArrowLeft } from "@/app/components/Icons";

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ node?: string }>;
}) {
  const { node } = await searchParams;

  // No specific node → send to session setup
  if (!node) {
    redirect("/session");
  }

  const nodeData = getNode(node);

  // Unknown node → send to session setup
  if (!nodeData || nodeData.exists_ === 0) {
    redirect("/session");
  }

  const queueNode = {
    id: nodeData.id,
    title: nodeData.title,
    type: nodeData.type,
    area: nodeData.area,
  };

  return (
    <div className="wrap">
      <div className="breadcrumb">
        <Link href={`/node/${encodeURIComponent(node)}`} className="icon-label"><ArrowLeft size={12} /> {nodeData.title}</Link> · practice
      </div>
      <StudyQueue queue={[queueNode]} enableCalibration={getCalibrationEnabled()} />
    </div>
  );
}

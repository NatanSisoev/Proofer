import Link from "next/link";
import { notFound } from "next/navigation";
import { pathway } from "@/lib/pathway";
import MathText from "@/app/components/MathText";
import PathwayLane from "@/app/components/PathwayLane";
import { ArrowLeft } from "@/app/components/Icons";

export const dynamic = "force-dynamic";

export default async function PathwayPage({
  params,
}: {
  params: Promise<{ target: string }>;
}) {
  const { target } = await params;
  const id = decodeURIComponent(target);
  const path = pathway(id);
  if (!path) notFound();

  return (
    <div className="wrap">
      <div className="breadcrumb">
        <Link href={`/node/${encodeURIComponent(path.targetId)}`} className="icon-label">
          <ArrowLeft size={12} /> <MathText>{path.targetTitle}</MathText>
        </Link>
        · guided path
      </div>
      <div className="page-top">
        <div>
          <h1>
            Path to <MathText>{path.targetTitle}</MathText>
          </h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            {path.units.length} concept{path.units.length !== 1 ? "s" : ""} on the way, in dependency order.
          </p>
        </div>
      </div>
      <PathwayLane pathway={path} />
    </div>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { getNode, saveMisconceptions, misconceptionsForNode } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Persist a reviewed set of misconception clusters for one concept.
 * Accepts { nodeId, clusters: {label, gap_count}[] }. Replaces any prior
 * saved clusters for that node (best-effort snapshot, not accumulating).
 */
export async function POST(req: NextRequest) {
  const { nodeId, clusters } = await req.json() as {
    nodeId?: string;
    clusters?: { label: string; gap_count: number }[];
  };
  if (!nodeId) {
    return NextResponse.json({ error: "nodeId required" }, { status: 400 });
  }
  const node = getNode(nodeId);
  if (!node || !node.exists_) {
    return NextResponse.json({ error: "Concept not found" }, { status: 404 });
  }
  if (!Array.isArray(clusters)) {
    return NextResponse.json({ error: "clusters array required" }, { status: 400 });
  }

  saveMisconceptions(nodeId, clusters);
  return NextResponse.json({ ok: true, saved: misconceptionsForNode(nodeId) });
}

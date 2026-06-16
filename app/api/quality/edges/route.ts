import { NextResponse } from "next/server";
import { relatedEdgesWithNodes, relatedEdgeCount } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** List unclassified `related` edges, with both node details. */
export async function GET() {
  const edges = relatedEdgesWithNodes(150);
  const total = relatedEdgeCount();
  return NextResponse.json({ edges, total });
}

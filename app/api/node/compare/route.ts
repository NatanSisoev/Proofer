import { NextRequest, NextResponse } from "next/server";
import { getNode } from "@/lib/queries";
import { compareConcepts, friendlyLLMError } from "@/lib/llm";
import { toStreamResponse } from "@/lib/stream";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let nodeIdA: string, nodeIdB: string;
  try {
    ({ nodeIdA, nodeIdB } = await req.json() as { nodeIdA: string; nodeIdB: string });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!nodeIdA || !nodeIdB) {
    return NextResponse.json({ error: "nodeIdA and nodeIdB required" }, { status: 400 });
  }
  const [a, b] = [getNode(nodeIdA), getNode(nodeIdB)];
  if (!a?.exists_ || !b?.exists_) {
    return NextResponse.json({ error: "One or both concepts not found" }, { status: 404 });
  }
  if (nodeIdA === nodeIdB) {
    return NextResponse.json({ error: "Cannot compare a concept with itself" }, { status: 400 });
  }
  // Sort so A-vs-B and B-vs-A share a cache entry.
  const [first, second] = a.id <= b.id ? [a, b] : [b, a];
  return toStreamResponse(compareConcepts(first, second), (e) => friendlyLLMError(e).message);
}

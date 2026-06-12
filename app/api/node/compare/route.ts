import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getNode } from "@/lib/queries";
import { compareConcepts, friendlyLLMError } from "@/lib/llm";
import type { NodeRow } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Comparisons only depend on the two nodes being compared — cache so
// repeat comparisons (in either order) are instant.
const getComparison = unstable_cache(
  async (a: NodeRow, b: NodeRow) => compareConcepts(a, b),
  ["compare-concepts"],
  { revalidate: 86400 }
);

export async function POST(req: NextRequest) {
  try {
    const { nodeIdA, nodeIdB } = await req.json() as { nodeIdA: string; nodeIdB: string };
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
    const [first, second] = a!.id <= b!.id ? [a!, b!] : [b!, a!];
    const comparison = await getComparison(first, second);
    return NextResponse.json({ comparison });
  } catch (e) {
    const { status, message } = friendlyLLMError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

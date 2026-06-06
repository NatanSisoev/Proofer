import { NextRequest, NextResponse } from "next/server";
import { getNode } from "@/lib/queries";
import { compareConcepts, friendlyLLMError } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    const comparison = await compareConcepts(a, b);
    return NextResponse.json({ comparison });
  } catch (e) {
    const { status, message } = friendlyLLMError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

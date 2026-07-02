import { NextRequest, NextResponse } from "next/server";
import { getNode, gapsForNode } from "@/lib/queries";
import { clusterMisconceptions, friendlyLLMError, hasKey } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ask the LLM to cluster one concept's gap texts into named misconceptions.
 * Accepts { nodeId }. Does NOT write to the database — the client confirms
 * (via /save) before persisting, mirroring the edge-classification pattern.
 */
export async function POST(req: NextRequest) {
  if (!hasKey()) {
    return NextResponse.json({ error: "No AI provider configured — set GEMINI_API_KEY or ANTHROPIC_API_KEY" }, { status: 400 });
  }

  const { nodeId } = await req.json() as { nodeId?: string };
  if (!nodeId) {
    return NextResponse.json({ error: "nodeId required" }, { status: 400 });
  }
  const node = getNode(nodeId);
  if (!node || !node.exists_) {
    return NextResponse.json({ error: "Concept not found" }, { status: 404 });
  }

  const gaps = gapsForNode(nodeId);
  try {
    const clusters = await clusterMisconceptions(node.title, gaps);
    return NextResponse.json({ clusters, gapsAnalyzed: gaps.length });
  } catch (e) {
    const { status, message } = friendlyLLMError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

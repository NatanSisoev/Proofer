import { NextRequest, NextResponse } from "next/server";
import { getNode } from "@/lib/queries";
import { reExplainConcept, friendlyLLMError, type ExplainAngle } from "@/lib/llm";
import { db } from "@/lib/db";
import { toStreamResponse } from "@/lib/stream";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let nodeId: string, angle: ExplainAngle | undefined;
  try {
    ({ nodeId, angle } = await req.json() as { nodeId: string; angle?: ExplainAngle });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const node = getNode(nodeId);
  if (!node || !node.exists_) {
    return NextResponse.json({ error: "Concept not found" }, { status: 404 });
  }

  // Fetch direct prerequisites for context
  const prereqRows = db()
    .prepare(
      `SELECT e.dst AS id FROM edges e
        WHERE e.src = ? AND e.type = 'depends_on'
        LIMIT 10`
    )
    .all(nodeId) as { id: string }[];
  const prereqs = prereqRows.map((r) => r.id);

  return toStreamResponse(reExplainConcept(node, prereqs, angle ?? "intuitive"), (e) => friendlyLLMError(e).message);
}

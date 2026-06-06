import { NextRequest, NextResponse } from "next/server";
import { getNode } from "@/lib/queries";
import { reExplainConcept, friendlyLLMError, type ExplainAngle } from "@/lib/llm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { nodeId, angle } = await req.json() as { nodeId: string; angle?: ExplainAngle };
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

    const explanation = await reExplainConcept(node, prereqs, angle ?? "intuitive");
    return NextResponse.json({ explanation });
  } catch (e) {
    const { status, message } = friendlyLLMError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

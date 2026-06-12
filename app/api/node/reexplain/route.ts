import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getNode } from "@/lib/queries";
import { reExplainConcept, friendlyLLMError, type ExplainAngle } from "@/lib/llm";
import { db, type NodeRow } from "@/lib/db";

export const dynamic = "force-dynamic";

// Re-explanations only depend on the node, its prerequisites, and the chosen
// angle — cache so switching back to a previously-viewed angle is instant.
const getReExplanation = unstable_cache(
  async (node: NodeRow, prereqs: string[], angle: ExplainAngle) => reExplainConcept(node, prereqs, angle),
  ["reexplain-concept"],
  { revalidate: 86400 }
);

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

    const explanation = await getReExplanation(node, prereqs, angle ?? "intuitive");
    return NextResponse.json({ explanation });
  } catch (e) {
    const { status, message } = friendlyLLMError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

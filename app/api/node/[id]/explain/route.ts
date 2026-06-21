import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { getNode } from "@/lib/queries";
import { explainConcept, hasKey, friendlyLLMError } from "@/lib/llm";
import type { NodeRow } from "@/lib/db";

export const maxDuration = 60;

// Explanations only depend on the node's content and its prerequisite list,
// neither of which changes often — cache so repeat visits are instant.
const getExplanation = unstable_cache(
  async (node: NodeRow, prereqs: string[]) => explainConcept(node, prereqs),
  ["explain-concept"],
  { revalidate: 86400 }
);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasKey()) return NextResponse.json({ error: "No AI provider configured" }, { status: 400 });

  const node = getNode(id);
  if (!node || node.exists_ === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  const prereqs = (
    db()
      .prepare(`SELECT e.dst FROM edges e JOIN nodes n ON n.id = e.dst WHERE e.src = ? AND e.type='depends_on' AND n.exists_=1`)
      .all(id) as { dst: string }[]
  ).map((r) => r.dst);

  try {
    const explanation = await getExplanation(node, prereqs);
    return NextResponse.json({ explanation });
  } catch (e) {
    const { status, message } = friendlyLLMError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

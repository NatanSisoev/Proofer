import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getNode } from "@/lib/queries";
import { explainConcept, HAS_KEY, friendlyLLMError } from "@/lib/llm";

export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!HAS_KEY) return NextResponse.json({ error: "No AI provider configured" }, { status: 400 });

  const node = getNode(id);
  if (!node || node.exists_ === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  const prereqs = (
    db()
      .prepare(`SELECT e.dst FROM edges e JOIN nodes n ON n.id = e.dst WHERE e.src = ? AND e.type='depends_on' AND n.exists_=1`)
      .all(id) as { dst: string }[]
  ).map((r) => r.dst);

  try {
    const explanation = await explainConcept(node, prereqs);
    return NextResponse.json({ explanation });
  } catch (e) {
    const { status, message } = friendlyLLMError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

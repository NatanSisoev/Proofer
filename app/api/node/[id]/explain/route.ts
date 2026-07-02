import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getNode } from "@/lib/queries";
import { explainConcept, hasKey, friendlyLLMError } from "@/lib/llm";
import { toStreamResponse } from "@/lib/stream";

export const maxDuration = 60;

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

  return toStreamResponse(explainConcept(node, prereqs), (e) => friendlyLLMError(e).message);
}

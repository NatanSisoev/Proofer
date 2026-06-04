import { NextRequest, NextResponse } from "next/server";
import { db, type NodeRow } from "@/lib/db";
import { getNode } from "@/lib/queries";
import { getMasteryP } from "@/lib/mastery";
import { generateProblem, HAS_KEY } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Direct, existing prerequisites of a node (depends_on targets that aren't ghosts).
function directPrereqs(id: string): string[] {
  return (
    db()
      .prepare(
        `SELECT e.dst FROM edges e JOIN nodes n ON n.id = e.dst
          WHERE e.src = ? AND e.type='depends_on' AND n.exists_ = 1`
      )
      .all(id) as { dst: string }[]
  ).map((r) => r.dst);
}

export async function POST(req: NextRequest) {
  const { nodeId } = await req.json();
  const node = getNode(nodeId) as NodeRow | undefined;
  if (!node || node.exists_ === 0) return NextResponse.json({ error: "unknown node" }, { status: 404 });

  const prereqs = directPrereqs(nodeId);
  const gen = await generateProblem(node, prereqs);

  const info = db()
    .prepare(
      `INSERT INTO problems(node_id,kind,problem,ideal_solution,rubric,prereqs,mode,created_at)
       VALUES(?,?,?,?,?,?,?,?)`
    )
    .run(
      nodeId,
      gen.kind,
      gen.problem,
      gen.ideal_solution,
      JSON.stringify(gen.rubric),
      JSON.stringify(prereqs),
      HAS_KEY ? "ai" : "demo",
      new Date().toISOString()
    );

  return NextResponse.json({
    problemId: Number(info.lastInsertRowid),
    problem: gen.problem,
    kind: gen.kind,
    mode: HAS_KEY ? "ai" : "demo",
    masteryBefore: getMasteryP(nodeId),
    node: { id: node.id, title: node.title, type: node.type, area: node.area },
  });
}

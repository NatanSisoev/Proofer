import { NextRequest, NextResponse } from "next/server";
import { db, type NodeRow } from "@/lib/db";
import { getNode } from "@/lib/queries";
import { getMasteryP } from "@/lib/mastery";
import { generateProblem, friendlyLLMError, hasKey, type ProblemKind } from "@/lib/llm";

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

const VALID_KINDS = new Set(["compute", "prove", "counterexample", "explain"]);

export async function POST(req: NextRequest) {
  let body: { nodeId?: string; kind?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const { nodeId } = body;
  const preferKind = (body.kind && VALID_KINDS.has(body.kind) ? body.kind : undefined) as ProblemKind | undefined;
  if (!nodeId) return NextResponse.json({ error: "nodeId required" }, { status: 400 });
  const node = getNode(nodeId) as NodeRow | undefined;
  if (!node || node.exists_ === 0) return NextResponse.json({ error: "unknown node" }, { status: 404 });

  const prereqs = directPrereqs(nodeId);

  // Pass recent non-correct gaps so the AI avoids repeating working parts
  // and focuses on the specific misconceptions the student keeps hitting.
  const recentGaps = (
    db()
      .prepare(
        `SELECT gap, verdict FROM attempts
          WHERE node_id = ? AND verdict != 'correct'
          ORDER BY id DESC LIMIT 3`
      )
      .all(nodeId) as { gap: string; verdict: string }[]
  )
    .map((r) => r.gap)
    .filter(Boolean);

  let gen;
  try {
    // Pass current mastery so difficulty targets the ~85% success band.
    gen = await generateProblem(node, prereqs, recentGaps, preferKind, getMasteryP(nodeId));
  } catch (e) {
    const { status, message } = friendlyLLMError(e);
    return NextResponse.json({ error: message }, { status });
  }

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
      hasKey() ? "ai" : "demo",
      new Date().toISOString()
    );

  return NextResponse.json({
    problemId: Number(info.lastInsertRowid),
    problem: gen.problem,
    kind: gen.kind,
    mode: hasKey() ? "ai" : "demo",
    masteryBefore: getMasteryP(nodeId),
    node: { id: node.id, title: node.title, type: node.type, area: node.area },
  });
}

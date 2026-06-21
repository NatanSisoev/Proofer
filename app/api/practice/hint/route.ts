import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateHint, hasKey, friendlyLLMError } from "@/lib/llm";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  if (!hasKey()) return NextResponse.json({ error: "No AI provider configured" }, { status: 400 });

  const { problemId } = await req.json();
  if (!problemId) return NextResponse.json({ error: "problemId required" }, { status: 400 });

  const row = db()
    .prepare(
      `SELECT p.problem, p.ideal_solution, p.kind, n.title, n.type
         FROM problems p
         JOIN nodes n ON n.id = p.node_id
        WHERE p.id = ?`
    )
    .get(problemId) as
    | { problem: string; ideal_solution: string; kind: string; title: string; type: string | null }
    | undefined;

  if (!row) return NextResponse.json({ error: "problem not found" }, { status: 404 });

  try {
    const hint = await generateHint({
      problem: row.problem,
      nodeTitle: row.title,
      nodeType: row.type,
      idealSolution: row.ideal_solution,
    });
    return NextResponse.json({ hint });
  } catch (e) {
    const { status, message } = friendlyLLMError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

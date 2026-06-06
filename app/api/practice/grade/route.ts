import { NextRequest, NextResponse } from "next/server";
import { db, type NodeRow } from "@/lib/db";
import { getNode } from "@/lib/queries";
import { applyAttempt, getMasteryP, recordAttempt } from "@/lib/mastery";
import { gradeAnswer, friendlyLLMError, HAS_KEY } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const { problemId, answer } = await req.json();
  const prob = db().prepare("SELECT * FROM problems WHERE id = ?").get(problemId) as any;
  if (!prob) return NextResponse.json({ error: "unknown problem" }, { status: 404 });

  const node = getNode(prob.node_id) as NodeRow | undefined;
  if (!node) return NextResponse.json({ error: "unknown node" }, { status: 404 });

  const prereqs: string[] = JSON.parse(prob.prereqs || "[]");
  const rubric: string[] = JSON.parse(prob.rubric || "[]");

  let grade;
  try {
    grade = await gradeAnswer({
      node,
      problem: prob.problem,
      idealSolution: prob.ideal_solution || "",
      rubric,
      answer: answer || "",
      prereqs,
    });
  } catch (e) {
    const { status, message } = friendlyLLMError(e);
    return NextResponse.json({ error: message }, { status });
  }

  const masteryBefore = getMasteryP(node.id);
  const blamed = grade.blamed_prerequisite && prereqs.includes(grade.blamed_prerequisite) ? grade.blamed_prerequisite : null;

  applyAttempt(node.id, grade.mastery_evidence, blamed, prereqs);
  recordAttempt({
    node_id: node.id,
    kind: prob.kind,
    problem: prob.problem,
    answer: answer || "",
    verdict: grade.verdict,
    evidence: grade.mastery_evidence,
    gap: grade.gap,
    blamed_prereq: blamed || "",
    mode: HAS_KEY ? "ai" : "demo",
  });

  // Return half_life so the UI can show "next review in ~N days"
  const masteryRow = db().prepare("SELECT half_life FROM mastery WHERE node_id = ?").get(node.id) as { half_life: number } | undefined;

  return NextResponse.json({
    ...grade,
    blamed_prerequisite: blamed || "",
    masteryBefore,
    masteryAfter: getMasteryP(node.id),
    halfLife: Math.round(masteryRow?.half_life ?? 7),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { db, type NodeRow, MASTERY_THRESHOLD } from "@/lib/db";
import { getNode, newlyUnlocked } from "@/lib/queries";
import { applyAttempt, getMasteryP, recordAttempt } from "@/lib/mastery";
import { gradeAnswer, friendlyLLMError, hasKey } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const { problemId, answer, predicted } = await req.json();
  // The student's pre-answer self-rating (0..1), only sent on the first attempt.
  // Clamp to a valid probability; anything missing/invalid is recorded as NULL.
  const predictedCorrect =
    typeof predicted === "number" && predicted >= 0 && predicted <= 1 ? predicted : null;
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
  const wasAlreadyMastered = masteryBefore >= MASTERY_THRESHOLD;
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
    mode: hasKey() ? "ai" : "demo",
    predicted_correct: predictedCorrect,
  });

  const masteryAfter = getMasteryP(node.id);
  const justMastered = !wasAlreadyMastered && masteryAfter >= MASTERY_THRESHOLD;

  // Return half_life so the UI can show "next review in ~N days"
  const masteryRow = db().prepare("SELECT half_life FROM mastery WHERE node_id = ?").get(node.id) as { half_life: number } | undefined;

  // If this attempt just pushed the concept over the mastery threshold, surface
  // which new concepts are now reachable on the learning frontier.
  const unlocked = justMastered ? newlyUnlocked(node.id).map((n) => ({ id: n.id, title: n.title, type: n.type, area: n.area })) : [];

  return NextResponse.json({
    ...grade,
    blamed_prerequisite: blamed || "",
    masteryBefore,
    masteryAfter,
    halfLife: Math.round(masteryRow?.half_life ?? 7),
    unlocked,
    justMastered,
  });
}

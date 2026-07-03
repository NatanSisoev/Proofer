import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getNode } from "@/lib/queries";
import { applyDialogueNudge, getMasteryP } from "@/lib/mastery";
import { continueDialogue, friendlyLLMError, DIALOGUE_MAX_STUDENT_TURNS, type DialogueTurn } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { attemptId, message } = await req.json();
  if (!attemptId || !message || !String(message).trim()) {
    return NextResponse.json({ error: "attemptId and message are required" }, { status: 400 });
  }

  const attempt = db().prepare("SELECT * FROM attempts WHERE id = ?").get(attemptId) as any;
  if (!attempt) return NextResponse.json({ error: "unknown attempt" }, { status: 404 });
  if (!attempt.problem_id) {
    return NextResponse.json({ error: "This attempt predates dialogue support." }, { status: 400 });
  }

  const prob = db().prepare("SELECT * FROM problems WHERE id = ?").get(attempt.problem_id) as any;
  if (!prob) return NextResponse.json({ error: "unknown problem" }, { status: 404 });

  const node = getNode(attempt.node_id);
  if (!node) return NextResponse.json({ error: "unknown node" }, { status: 404 });

  let transcript: DialogueTurn[] = [];
  try {
    transcript = JSON.parse(attempt.dialogue || "[]");
  } catch {
    transcript = [];
  }

  const priorStudentTurns = transcript.filter((t) => t.role === "student").length;
  if (priorStudentTurns >= DIALOGUE_MAX_STUDENT_TURNS) {
    return NextResponse.json({ error: "This dialogue has reached its turn limit." }, { status: 400 });
  }

  transcript.push({ role: "student", text: String(message) });

  let result;
  try {
    result = await continueDialogue({
      node,
      problem: prob.problem,
      idealSolution: prob.ideal_solution || "",
      gap: attempt.gap || "",
      transcript,
    });
  } catch (e) {
    const { status, message: msg } = friendlyLLMError(e);
    return NextResponse.json({ error: msg }, { status });
  }

  transcript.push({ role: "tutor", text: result.message });
  db().prepare("UPDATE attempts SET dialogue = ? WHERE id = ?").run(JSON.stringify(transcript), attemptId);

  let masteryAfter: number | undefined;
  if (result.done && typeof result.masteryEvidence === "number") {
    applyDialogueNudge(attempt.node_id, result.masteryEvidence);
    masteryAfter = getMasteryP(attempt.node_id);
  }

  return NextResponse.json({
    message: result.message,
    done: result.done,
    masteryAfter,
  });
}

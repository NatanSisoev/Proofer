import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyAttempt } from "@/lib/mastery";

export async function POST(req: NextRequest) {
  const { problemId } = await req.json();
  const row = db()
    .prepare("SELECT * FROM problems WHERE id = ?")
    .get(problemId) as any;

  if (!row) return NextResponse.json({ error: "unknown problem" }, { status: 404 });

  // Record as incorrect with zero evidence
  const prereqs = row.prereqs ? JSON.parse(row.prereqs) : [];
  const masteryBefore = (db().prepare("SELECT p FROM mastery WHERE node_id = ?").get(row.node_id) as any)?.p ?? 0;
  applyAttempt(row.node_id, 0, null, prereqs);
  const masteryAfter = (db().prepare("SELECT p FROM mastery WHERE node_id = ?").get(row.node_id) as any)?.p ?? 0;
  // The give-up marker goes in `gap`: every display site and the node page's
  // "last gap identified" logic detect a reveal by `gap === "(gave up — showed
  // answer)"`. It used to sit in `answer`, so those checks silently never
  // matched — a give-up surfaced as a real diagnosed gap instead of "Viewed
  // answer". The student's answer is genuinely empty here (they didn't attempt).
  // `problem` is NOT NULL — omitting it made every reveal throw an INSERT
  // constraint error (500), so the give-up was never logged even though the
  // mastery ding above had already applied. Carry the problem text over from
  // the problems row.
  db().prepare(
    `INSERT INTO attempts (node_id, kind, problem, answer, verdict, evidence, gap, blamed_prereq, mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.node_id, row.kind, row.problem, "",
    "incorrect", 0,
    "(gave up — showed answer)",
    "", row.mode ?? "ai"
  );

  return NextResponse.json({
    idealSolution: row.ideal_solution,
    masteryBefore,
    masteryAfter,
  });
}

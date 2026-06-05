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
  db().prepare(
    `INSERT INTO attempts (node_id, kind, answer, verdict, evidence, gap, blamed_prereq, mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.node_id, row.kind, "(gave up — showed answer)",
    "incorrect", 0,
    "Student requested to see the answer without attempting.",
    "", row.mode ?? "ai"
  );

  return NextResponse.json({
    idealSolution: row.ideal_solution,
    masteryBefore,
    masteryAfter,
  });
}

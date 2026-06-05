import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { diagnoseWeakness, HAS_KEY } from "@/lib/llm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!HAS_KEY) return NextResponse.json({ diagnosis: "" });

  const attempts = db()
    .prepare(
      `SELECT gap, blamed_prereq, verdict FROM attempts
        WHERE node_id = ? ORDER BY id DESC LIMIT 10`
    )
    .all(id) as { gap: string; blamed_prereq: string; verdict: string }[];

  if (attempts.length < 2) return NextResponse.json({ diagnosis: "" });

  const nonCorrect = attempts.filter((a) => a.verdict !== "correct");
  if (nonCorrect.length < 2) return NextResponse.json({ diagnosis: "" });

  const gaps = nonCorrect.map((a) => a.gap).filter(Boolean);
  const prereqs = nonCorrect.map((a) => a.blamed_prereq).filter(Boolean);

  const diagnosis = await diagnoseWeakness(id, gaps, prereqs);
  return NextResponse.json({ diagnosis });
}

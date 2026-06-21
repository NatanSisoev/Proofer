import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { areaMastery } from "@/lib/queries";
import { generateStudyPlan, friendlyLLMError, hasKey } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!hasKey()) return NextResponse.json({ error: "No LLM key configured" }, { status: 503 });

  try {
    const { targetDate, focusArea } = await req.json() as { targetDate: string; focusArea?: string };
    if (!targetDate) return NextResponse.json({ error: "targetDate required" }, { status: 400 });

    const stats = db().prepare(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN m.p >= 0.8 THEN 1 ELSE 0 END) AS mastered
        FROM nodes n
        LEFT JOIN mastery m ON m.node_id = n.id
       WHERE n.exists_ = 1
    `).get() as { total: number; mastered: number };

    const areas = areaMastery()
      .filter(a => a.total > 0)
      .sort((a, b) => a.avg_p - b.avg_p)
      .slice(0, 8)
      .map(a => ({ area: a.area, avg_p: a.avg_p, count: a.total }));

    const unmastered = db().prepare(`
      SELECT n.id, n.title, n.area, COALESCE(m.p, 0) AS mastery_p
        FROM nodes n
        LEFT JOIN mastery m ON m.node_id = n.id
       WHERE n.exists_ = 1
         AND COALESCE(m.p, 0) < 0.8
         ${focusArea ? "AND n.area = ?" : ""}
       ORDER BY COALESCE(m.p, 0) ASC
       LIMIT 30
    `).all(...(focusArea ? [focusArea] : [])) as { id: string; title: string; area: string | null; mastery_p: number }[];

    const plan = await generateStudyPlan({
      targetDate,
      focusArea,
      totalConcepts: stats.total,
      masteredConcepts: stats.mastered ?? 0,
      weakAreas: areas,
      unmastered,
    });

    return NextResponse.json({ plan });
  } catch (e) {
    const { status, message } = friendlyLLMError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextResponse } from "next/server";
import { db, MASTERY_THRESHOLD } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/random?mastered=false (default) | mastered=true | mastered=any
 * Returns a random concept node as { id, title, type, area }.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mastered = url.searchParams.get("mastered") ?? "false";

  let whereExtra = "";
  if (mastered === "false") {
    whereExtra = `AND (m.p IS NULL OR m.p < ${MASTERY_THRESHOLD})`;
  } else if (mastered === "true") {
    whereExtra = `AND m.p >= ${MASTERY_THRESHOLD}`;
  }

  const row = db()
    .prepare(
      `SELECT n.id, n.title, n.type, n.area
         FROM nodes n
         LEFT JOIN mastery m ON m.node_id = n.id
        WHERE n.exists_ = 1
          ${whereExtra}
        ORDER BY RANDOM()
        LIMIT 1`
    )
    .get() as { id: string; title: string; type: string | null; area: string | null } | undefined;

  if (!row) return NextResponse.json({ error: "No concepts found" }, { status: 404 });
  return NextResponse.json(row);
}

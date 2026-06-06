import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Snooze a due-for-review concept by advancing its last_seen date forward by N days.
 * Effectively pushes the next review out without changing mastery level or half-life.
 */
export async function POST(req: NextRequest) {
  const { nodeId, days = 2 } = await req.json();
  if (typeof nodeId !== "string") return NextResponse.json({ error: "nodeId required" }, { status: 400 });
  const d = Math.max(1, Math.min(14, Number(days) || 2));

  db()
    .prepare(
      `UPDATE mastery
          SET last_seen = strftime('%Y-%m-%dT%H:%M:%SZ',
                            COALESCE(last_seen, datetime('now')),
                            '+' || ? || ' days')
        WHERE node_id = ?`
    )
    .run(d, nodeId);

  return NextResponse.json({ ok: true });
}

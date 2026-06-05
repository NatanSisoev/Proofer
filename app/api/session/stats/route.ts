import { NextResponse } from "next/server";
import { db, MASTERY_THRESHOLD } from "@/lib/db";
import { P_INIT } from "@/lib/mastery";

export const dynamic = "force-dynamic";

export async function GET() {
  const due = (db().prepare(`
    SELECT COUNT(*) AS n FROM nodes n
    JOIN mastery m ON m.node_id = n.id
    WHERE n.exists_ = 1 AND m.p >= ${P_INIT} AND m.last_seen IS NOT NULL
      AND julianday('now') - julianday(m.last_seen) > m.half_life * 0.8
  `).get() as any).n as number;

  const weak = (db().prepare(`
    SELECT COUNT(*) AS n FROM nodes n
    JOIN mastery m ON m.node_id = n.id
    WHERE n.exists_ = 1 AND m.p < ${MASTERY_THRESHOLD} AND m.p >= ${P_INIT * 0.9}
  `).get() as any).n as number;

  const frontier = (db().prepare(`
    SELECT COUNT(*) AS n FROM nodes n
    LEFT JOIN mastery m ON m.node_id = n.id
    WHERE n.exists_ = 1 AND COALESCE(m.p, 0) < ${MASTERY_THRESHOLD}
      AND NOT EXISTS (
        SELECT 1 FROM edges e
        JOIN mastery m2 ON m2.node_id = e.dst
        WHERE e.src = n.id AND e.type = 'depends_on'
          AND COALESCE(m2.p, 0) < ${MASTERY_THRESHOLD}
      )
  `).get() as any).n as number;

  return NextResponse.json({ due, weak, frontier });
}

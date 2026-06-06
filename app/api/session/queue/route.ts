import { NextRequest, NextResponse } from "next/server";
import { db, MASTERY_THRESHOLD } from "@/lib/db";
import { P_INIT } from "@/lib/mastery";

export const dynamic = "force-dynamic";

type QueueNode = { id: string; title: string; type: string | null; area: string | null; mastery_p?: number };

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get("mode") || "smart";
  const area = searchParams.get("area") || null;
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);

  let rows: QueueNode[] = [];

  if (mode === "due") {
    // concepts past their review due date
    rows = db().prepare(`
      SELECT n.id, n.title, n.type, n.area
      FROM nodes n
      JOIN mastery m ON m.node_id = n.id
      WHERE n.exists_ = 1
        AND m.p >= ?
        AND m.last_seen IS NOT NULL
        AND julianday('now') - julianday(m.last_seen) > m.half_life * 0.8
      ORDER BY (julianday('now') - julianday(m.last_seen)) / m.half_life DESC
      LIMIT ?
    `).all(P_INIT, limit) as QueueNode[];
  } else if (mode === "weak") {
    // practiced but still low mastery
    rows = db().prepare(`
      SELECT n.id, n.title, n.type, n.area
      FROM nodes n
      JOIN mastery m ON m.node_id = n.id
      WHERE n.exists_ = 1
        AND m.p < ?
        AND m.p >= ?
      ORDER BY m.p ASC
      LIMIT ?
    `).all(MASTERY_THRESHOLD, P_INIT * 0.9, limit) as QueueNode[];
  } else if (mode === "area" && area) {
    // frontier concepts in a specific area
    rows = db().prepare(`
      SELECT n.id, n.title, n.type, n.area
      FROM nodes n
      LEFT JOIN mastery m ON m.node_id = n.id
      WHERE n.exists_ = 1
        AND n.area = ?
        AND COALESCE(m.p, 0) < ?
      ORDER BY COALESCE(m.p, 0) ASC
      LIMIT ?
    `).all(area, MASTERY_THRESHOLD, limit) as QueueNode[];
  } else {
    // smart: due first → in-progress frontier → fresh frontier → weak
    const due = db().prepare(`
      SELECT n.id, n.title, n.type, n.area
      FROM nodes n
      JOIN mastery m ON m.node_id = n.id
      WHERE n.exists_ = 1
        AND m.p >= ?
        AND m.last_seen IS NOT NULL
        AND julianday('now') - julianday(m.last_seen) > m.half_life * 0.8
      ORDER BY (julianday('now') - julianday(m.last_seen)) / m.half_life DESC
      LIMIT 5
    `).all(P_INIT) as QueueNode[];

    // frontier concepts you've already started (mastery > 0 but not yet mastered)
    const inProgress = db().prepare(`
      SELECT n.id, n.title, n.type, n.area
      FROM nodes n
      JOIN mastery m ON m.node_id = n.id
      WHERE n.exists_ = 1
        AND m.p > ? AND m.p < ?
        AND NOT EXISTS (
          SELECT 1 FROM edges e
          LEFT JOIN mastery m2 ON m2.node_id = e.dst
          WHERE e.src = n.id AND e.type = 'depends_on'
          AND COALESCE(m2.p, 0) < ?
        )
      ORDER BY m.p DESC
      LIMIT 5
    `).all(0, MASTERY_THRESHOLD, MASTERY_THRESHOLD) as QueueNode[];

    // brand-new frontier concepts (never touched, all prereqs known)
    const frontier = db().prepare(`
      SELECT n.id, n.title, n.type, n.area
      FROM nodes n
      LEFT JOIN mastery m ON m.node_id = n.id
      WHERE n.exists_ = 1
        AND COALESCE(m.p, 0) = 0
        AND NOT EXISTS (
          SELECT 1 FROM edges e
          LEFT JOIN mastery m2 ON m2.node_id = e.dst
          WHERE e.src = n.id AND e.type = 'depends_on'
          AND COALESCE(m2.p, 0) < ?
        )
      ORDER BY (SELECT COUNT(*) FROM edges e3 WHERE e3.dst = n.id AND e3.type='depends_on') DESC
      LIMIT 8
    `).all(MASTERY_THRESHOLD) as QueueNode[];

    const seen = new Set([...due.map((r) => r.id)]);
    const combined: QueueNode[] = [...due];
    for (const r of inProgress) {
      if (!seen.has(r.id) && combined.length < limit) {
        seen.add(r.id);
        combined.push(r);
      }
    }
    for (const r of frontier) {
      if (!seen.has(r.id) && combined.length < limit) {
        seen.add(r.id);
        combined.push(r);
      }
    }

    // fill remaining with weak spots
    if (combined.length < limit) {
      const weak = db().prepare(`
        SELECT n.id, n.title, n.type, n.area
        FROM nodes n
        JOIN mastery m ON m.node_id = n.id
        WHERE n.exists_ = 1
          AND m.p < ?
          AND m.p >= ?
        ORDER BY m.p ASC
        LIMIT ?
      `).all(MASTERY_THRESHOLD, P_INIT * 0.9, limit - combined.length) as QueueNode[];
      for (const r of weak) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          combined.push(r);
        }
      }
    }

    rows = combined;
  }

  // Attach mastery data in one batch query
  if (rows.length > 0) {
    const placeholders = rows.map(() => "?").join(",");
    const masteryMap = new Map(
      (db().prepare(`SELECT node_id, p FROM mastery WHERE node_id IN (${placeholders})`).all(...rows.map(r => r.id)) as { node_id: string; p: number }[])
        .map(r => [r.node_id, r.p])
    );
    rows = rows.map(r => ({ ...r, mastery_p: masteryMap.get(r.id) ?? 0 }));
  }

  return NextResponse.json({ queue: rows });
}

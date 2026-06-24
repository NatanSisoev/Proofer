import { NextRequest, NextResponse } from "next/server";
import { db, MASTERY_THRESHOLD } from "@/lib/db";
import { P_INIT, infoGainRanked } from "@/lib/mastery";
import { overconfidentConcepts } from "@/lib/queries";
import { getSelectionPolicy } from "@/lib/settings";

export const dynamic = "force-dynamic";

type QueueNode = { id: string; title: string; type: string | null; area: string | null; mastery_p?: number; reason?: string };

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get("mode") || "smart";
  const area = searchParams.get("area") || null;
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);
  const idsParam = searchParams.get("ids") || null;

  let rows: QueueNode[] = [];

  if (mode === "ids" && idsParam) {
    // Fetch specific nodes by ID, in the requested order
    const ids = idsParam.split(",").filter(Boolean).slice(0, 20);
    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(",");
      const found = db().prepare(`
        SELECT n.id, n.title, n.type, n.area
        FROM nodes n
        WHERE n.id IN (${placeholders}) AND n.exists_ = 1
      `).all(...ids) as QueueNode[];
      // Preserve the requested order
      const byId = new Map(found.map((r) => [r.id, r]));
      rows = ids.map((id) => byId.get(id)).filter(Boolean) as QueueNode[];
    }
  } else if (mode === "due") {
    rows = (db().prepare(`
      SELECT n.id, n.title, n.type, n.area
      FROM nodes n
      JOIN mastery m ON m.node_id = n.id
      WHERE n.exists_ = 1
        AND m.p >= ?
        AND m.last_seen IS NOT NULL
        AND julianday('now') - julianday(m.last_seen) > m.half_life * 0.8
      ORDER BY (julianday('now') - julianday(m.last_seen)) / m.half_life DESC
      LIMIT ?
    `).all(P_INIT, limit) as QueueNode[]).map((r) => ({ ...r, reason: "due for review" }));
  } else if (mode === "weak") {
    rows = (db().prepare(`
      SELECT n.id, n.title, n.type, n.area
      FROM nodes n
      JOIN mastery m ON m.node_id = n.id
      WHERE n.exists_ = 1
        AND m.p < ?
        AND m.p >= ?
      ORDER BY m.p ASC
      LIMIT ?
    `).all(MASTERY_THRESHOLD, P_INIT * 0.9, limit) as QueueNode[]).map((r) => ({ ...r, reason: "weak spot" }));
  } else if (mode === "bookmarks") {
    rows = (db().prepare(`
      SELECT n.id, n.title, n.type, n.area
      FROM nodes n
      JOIN bookmarks b ON b.node_id = n.id
      LEFT JOIN mastery m ON m.node_id = n.id
      WHERE n.exists_ = 1
      ORDER BY COALESCE(m.p, 0) ASC
      LIMIT ?
    `).all(limit) as QueueNode[]).map((r) => ({ ...r, reason: "bookmarked" }));
  } else if (mode === "blindspots") {
    rows = overconfidentConcepts(limit).map((c) => ({
      id: c.id, title: c.title, type: c.type, area: c.area, reason: "blind spot",
    }));
  } else if (mode === "area" && area) {
    rows = (db().prepare(`
      SELECT n.id, n.title, n.type, n.area
      FROM nodes n
      LEFT JOIN mastery m ON m.node_id = n.id
      WHERE n.exists_ = 1
        AND n.area = ?
        AND COALESCE(m.p, 0) < ?
      ORDER BY COALESCE(m.p, 0) ASC
      LIMIT ?
    `).all(area, MASTERY_THRESHOLD, limit) as QueueNode[]).map((r) => ({ ...r, reason: undefined }));
  } else {
    // smart: due reviews first (retention is time-critical), then either
    // information-gain ranking (the default policy) or the classic greedy
    // in-progress → fresh frontier → weak ordering.
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

    if (getSelectionPolicy() === "infogain") {
      const seen = new Set(due.map((r) => r.id));
      const combined: QueueNode[] = due.map((r) => ({ ...r, reason: "due for review" }));
      // Pull extra candidates so de-duping against `due` can't starve the queue.
      for (const c of infoGainRanked(limit * 2)) {
        if (combined.length >= limit) break;
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        // Surface *why* this concept was chosen — the policy made visible.
        const reason = c.overconf > 0 ? "blind spot"
          : c.attempts === 0 ? "ready to learn"
          : "near your edge";
        combined.push({ id: c.id, title: c.title, type: c.type, area: c.area, reason });
      }
      rows = combined; // falls through to the shared mastery-attach + return below
    } else {
    // frontier concepts you've already started (mastery > 0 but not yet mastered).
    // Ghost prereqs (exists_=0) are excluded — matches frontier() semantics in lib/queries.ts.
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
            AND e.dst IN (SELECT id FROM nodes WHERE exists_ = 1)
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
            AND e.dst IN (SELECT id FROM nodes WHERE exists_ = 1)
            AND COALESCE(m2.p, 0) < ?
        )
      ORDER BY (SELECT COUNT(*) FROM edges e3 WHERE e3.dst = n.id AND e3.type='depends_on') DESC
      LIMIT 8
    `).all(MASTERY_THRESHOLD) as QueueNode[];

    const seen = new Set([...due.map((r) => r.id)]);
    const combined: QueueNode[] = [...due.map((r) => ({ ...r, reason: "due for review" }))];
    for (const r of inProgress) {
      if (!seen.has(r.id) && combined.length < limit) {
        seen.add(r.id);
        combined.push({ ...r, reason: "in progress" });
      }
    }
    for (const r of frontier) {
      if (!seen.has(r.id) && combined.length < limit) {
        seen.add(r.id);
        combined.push({ ...r, reason: "ready to learn" });
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
          combined.push({ ...r, reason: "weak spot" });
        }
      }
    }

    rows = combined;
    } // end greedy policy
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

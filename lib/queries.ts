import { db, MASTERED_SUBQUERY, MASTERY_THRESHOLD, type NodeRow, type EdgeRow } from "./db";
import { getMasteryP, setKnown as masterySetKnown, P_INIT } from "./mastery";

export function getNode(id: string): NodeRow | undefined {
  return db().prepare("SELECT * FROM nodes WHERE id = ?").get(id) as NodeRow | undefined;
}

export function edgesOf(id: string): { outgoing: EdgeRow[]; incoming: EdgeRow[] } {
  const outgoing = db()
    .prepare("SELECT * FROM edges WHERE src = ? ORDER BY confidence DESC")
    .all(id) as EdgeRow[];
  const incoming = db()
    .prepare("SELECT * FROM edges WHERE dst = ? ORDER BY confidence DESC")
    .all(id) as EdgeRow[];
  return { outgoing, incoming };
}

export function isKnown(id: string): boolean {
  return getMasteryP(id) >= MASTERY_THRESHOLD;
}

export function setKnown(id: string, known: boolean) {
  masterySetKnown(id, known);
}

/**
 * Transitive prerequisite closure over depends_on, CYCLE-SAFE.
 * SQLite has no CYCLE clause, so we carry the visited path and refuse to
 * re-enter a node. Also returns the max dependency DEPTH.
 */
export function prerequisites(id: string): { closure: NodeRow[]; depth: number } {
  const rows = db()
    .prepare(
      `WITH RECURSIVE closure(id, depth, path) AS (
         SELECT dst, 1, '/' || ? || '/' || dst || '/'
           FROM edges WHERE src = ? AND type = 'depends_on'
         UNION ALL
         SELECT e.dst, c.depth + 1, c.path || e.dst || '/'
           FROM edges e
           JOIN closure c ON e.src = c.id
          WHERE e.type = 'depends_on'
            AND instr(c.path, '/' || e.dst || '/') = 0
            AND c.depth < 50
       )
       SELECT id, MIN(depth) AS depth FROM closure GROUP BY id`
    )
    .all(id, id) as { id: string; depth: number }[];

  const depth = rows.reduce((m, r) => Math.max(m, r.depth), 0);
  if (rows.length === 0) return { closure: [], depth: 0 };
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const nodes = db()
    .prepare(`SELECT * FROM nodes WHERE id IN (${placeholders})`)
    .all(...ids) as NodeRow[];
  const depthMap = new Map(rows.map((r) => [r.id, r.depth]));
  nodes.sort((a, b) => (depthMap.get(a.id)! - depthMap.get(b.id)!) || a.title.localeCompare(b.title));
  return { closure: nodes, depth };
}

/**
 * Readiness = fraction of the prerequisite closure you've already marked known.
 * This is the personalized signal ChatGPT structurally cannot provide.
 */
export function readiness(id: string): { score: number; known: number; total: number; missing: NodeRow[] } {
  const { closure } = prerequisites(id);
  const real = closure.filter((n) => n.exists_ === 1);
  if (real.length === 0) return { score: 1, known: 0, total: 0, missing: [] };
  const knownSet = new Set(
    (db().prepare(MASTERED_SUBQUERY).all() as { node_id: string }[]).map((r) => r.node_id)
  );
  const missing = real.filter((n) => !knownSet.has(n.id));
  const known = real.length - missing.length;
  return { score: known / real.length, known, total: real.length, missing };
}

/**
 * The knowledge FRONTIER: not-yet-known concepts whose every direct prerequisite
 * IS known. Ranked by "unlock potential" (how many other concepts depend on it).
 * Start knowing nothing => the frontier is the foundations.
 */
export function frontier(limit = 40): (NodeRow & { unlocks: number })[] {
  return db()
    .prepare(
      `SELECT n.*,
              (SELECT COUNT(*) FROM edges e2 WHERE e2.dst = n.id AND e2.type='depends_on') AS unlocks
         FROM nodes n
        WHERE n.exists_ = 1
          AND n.id NOT IN (${MASTERED_SUBQUERY})
          AND NOT EXISTS (
            SELECT 1 FROM edges e
             WHERE e.src = n.id AND e.type = 'depends_on'
               AND e.dst <> n.id
               AND e.dst NOT IN (${MASTERED_SUBQUERY})
               AND e.dst IN (SELECT id FROM nodes WHERE exists_ = 1)
          )
        ORDER BY unlocks DESC, n.title ASC
        LIMIT ?`
    )
    .all(limit) as (NodeRow & { unlocks: number })[];
}

/**
 * Concepts that just became reachable on the frontier because `nodeId` was
 * just mastered. Returns nodes that:
 *   - depend directly on nodeId
 *   - exist
 *   - are not yet mastered
 *   - have ALL their other prerequisites mastered
 */
export function newlyUnlocked(nodeId: string): NodeRow[] {
  return db()
    .prepare(
      `SELECT n.* FROM nodes n
        JOIN edges e ON e.src = n.id AND e.type = 'depends_on' AND e.dst = ?
       WHERE n.exists_ = 1
         AND n.id NOT IN (${MASTERED_SUBQUERY})
         AND NOT EXISTS (
           SELECT 1 FROM edges e2
            WHERE e2.src = n.id AND e2.type = 'depends_on'
              AND e2.dst <> n.id AND e2.dst <> ?
              AND e2.dst IN (SELECT id FROM nodes WHERE exists_ = 1)
              AND e2.dst NOT IN (${MASTERED_SUBQUERY})
         )
       LIMIT 8`
    )
    .all(nodeId, nodeId) as NodeRow[];
}

/**
 * Concepts due for spaced-repetition review: has been practiced, mastery has
 * decayed past half_life since last_seen. Sorted by most overdue first.
 */
export function dueForReview(limit = 20): (BrowseNode & { days_overdue: number; p_decayed: number })[] {
  const rows = db()
    .prepare(
      `SELECT n.*,
              COALESCE(m.p, 0) AS mastery_p,
              m.half_life,
              m.last_seen,
              (julianday('now') - julianday(m.last_seen)) AS days_elapsed,
              (julianday('now') - julianday(m.last_seen)) - m.half_life AS days_overdue
         FROM nodes n
         JOIN mastery m ON m.node_id = n.id
        WHERE n.exists_ = 1
          AND m.last_seen IS NOT NULL
          AND m.p > 0.1
          AND (julianday('now') - julianday(m.last_seen)) > m.half_life * 0.8
        ORDER BY days_overdue DESC
        LIMIT ?`
    )
    .all(limit) as any[];
  // compute exponential decay in JS (node:sqlite has no math functions)
  return rows.map((r) => ({
    ...r,
    p_decayed: r.mastery_p * Math.pow(0.5, r.days_elapsed / r.half_life),
  }));
}

/** How many reviews are expected each day over the next 8 days. */
export function reviewForecast(): { date: string; count: number }[] {
  const rows = db()
    .prepare(
      `SELECT
         date(m.last_seen, '+' || CAST(m.half_life * 0.8 AS INTEGER) || ' days') AS due_date,
         COUNT(*) AS count
         FROM mastery m
         JOIN nodes n ON n.id = m.node_id
        WHERE n.exists_ = 1 AND m.last_seen IS NOT NULL AND m.p > 0.1
          AND date(m.last_seen, '+' || CAST(m.half_life * 0.8 AS INTEGER) || ' days') >= date('now')
          AND date(m.last_seen, '+' || CAST(m.half_life * 0.8 AS INTEGER) || ' days') < date('now', '+8 days')
        GROUP BY due_date
        ORDER BY due_date`
    )
    .all() as { due_date: string; count: number }[];

  // Fill all 8 days, even those with 0 reviews
  const map = new Map(rows.map((r) => [r.due_date, r.count]));
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date(Date.now() + i * 86400000);
    const key = d.toISOString().slice(0, 10);
    return { date: key, count: map.get(key) ?? 0 };
  });
}

/** Attempt count for a single concept. */
export function attemptCount(nodeId: string): number {
  const row = db().prepare("SELECT COUNT(*) AS n FROM attempts WHERE node_id = ?").get(nodeId) as { n: number };
  return row.n;
}

/** Recent attempts for a single concept (for the node page timeline). */
export function nodeAttempts(nodeId: string, limit = 10): { verdict: string; created_at: string; kind: string }[] {
  return db()
    .prepare(
      `SELECT verdict, created_at, kind FROM attempts
        WHERE node_id = ? ORDER BY id DESC LIMIT ?`
    )
    .all(nodeId, limit) as { verdict: string; created_at: string; kind: string }[];
}

/**
 * Recent attempts with problem text, for the node detail page.
 * The attempts table stores the problem text directly — no join needed.
 * Does NOT expose the ideal_solution (stays server-side).
 */
export function nodeAttemptDetails(
  nodeId: string,
  limit = 8
): { id: number; problem: string; kind: string | null; verdict: string; gap: string | null; created_at: string }[] {
  return db()
    .prepare(
      `SELECT id, problem, kind, verdict, gap, created_at
         FROM attempts
        WHERE node_id = ? AND problem IS NOT NULL AND problem != ''
        ORDER BY id DESC
        LIMIT ?`
    )
    .all(nodeId, limit) as any[];
}

/** Time series of mastery for one concept, for sparklines. */
export function masteryHistory(nodeId: string, limit = 30): { p: number; recorded_at: string }[] {
  return db()
    .prepare(
      `SELECT p, recorded_at FROM mastery_history
        WHERE node_id = ?
        ORDER BY id ASC
        LIMIT ?`
    )
    .all(nodeId, limit) as { p: number; recorded_at: string }[];
}

/** Full graph data for the global graph view. */
export function graphData(area?: string) {
  const nodeRows = db()
    .prepare(
      `SELECT n.id, n.title, n.type, n.area, n.exists_,
              COALESCE(m.p, 0) AS mastery_p,
              (SELECT COUNT(*) FROM edges e WHERE e.dst = n.id AND e.type='depends_on') AS dep_count
         FROM nodes n
         LEFT JOIN mastery m ON m.node_id = n.id
        WHERE n.exists_ = 1
          ${area ? "AND n.area = ?" : ""}
        ORDER BY dep_count DESC`
    )
    .all(...(area ? [area] : [])) as {
      id: string; title: string; type: string | null; area: string | null;
      exists_: number; mastery_p: number; dep_count: number;
    }[];

  const ids = new Set(nodeRows.map((n) => n.id));
  const edgeRows = db()
    .prepare(
      `SELECT src, dst, type FROM edges
        WHERE type IN ('depends_on','generalizes','equivalent_to','contradicts')
          AND src IN (SELECT id FROM nodes WHERE exists_=1)
          AND dst IN (SELECT id FROM nodes WHERE exists_=1)`
    )
    .all() as { src: string; dst: string; type: string }[];

  const filteredEdges = area
    ? edgeRows.filter((e) => ids.has(e.src) && ids.has(e.dst))
    : edgeRows;

  return { nodes: nodeRows, edges: filteredEdges };
}

/** k-hop ego subgraph around a node (we never render the whole graph). */
export function egoGraph(id: string, depth = 1) {
  const seen = new Set<string>([id]);
  let frontierIds = [id];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const nid of frontierIds) {
      const ph = "?";
      const neigh = db()
        .prepare(`SELECT dst AS o FROM edges WHERE src = ${ph} UNION SELECT src AS o FROM edges WHERE dst = ${ph}`)
        .all(nid, nid) as { o: string }[];
      for (const { o } of neigh) if (!seen.has(o)) { seen.add(o); next.push(o); }
    }
    frontierIds = next;
  }
  const ids = [...seen];
  const ph = ids.map(() => "?").join(",");
  const nodes = db()
    .prepare(`SELECT id,title,type,area,exists_ FROM nodes WHERE id IN (${ph})`)
    .all(...ids) as Pick<NodeRow, "id" | "title" | "type" | "area" | "exists_">[];
  const edges = db()
    .prepare(
      `SELECT src,dst,type,confidence FROM edges WHERE src IN (${ph}) AND dst IN (${ph})`
    )
    .all(...ids, ...ids) as Pick<EdgeRow, "src" | "dst" | "type" | "confidence">[];
  const knownSet = new Set(
    (db().prepare(MASTERED_SUBQUERY).all() as { node_id: string }[]).map((r) => r.node_id)
  );
  return {
    nodes: nodes.map((n) => ({ ...n, known: knownSet.has(n.id) ? 1 : 0 })),
    edges,
    center: id,
  };
}

export type BrowseArea = { area: string; count: number; avg_mastery: number };
export type BrowseNode = NodeRow & { mastery_p: number };

export function browseAreas(): BrowseArea[] {
  return db()
    .prepare(
      `SELECT n.area,
              COUNT(*) AS count,
              AVG(COALESCE(m.p, 0)) AS avg_mastery
         FROM nodes n
         LEFT JOIN mastery m ON m.node_id = n.id
        WHERE n.exists_ = 1 AND n.area IS NOT NULL
        GROUP BY n.area
        ORDER BY n.area ASC`
    )
    .all() as BrowseArea[];
}

export function nodesInArea(
  area: string,
  opts: { type?: string; sort?: "mastery_asc" | "mastery_desc" | "alpha" } = {}
): BrowseNode[] {
  const { type, sort = "mastery_asc" } = opts;
  const order =
    sort === "mastery_desc" ? "mastery_p DESC" : sort === "alpha" ? "n.title ASC" : "mastery_p ASC";
  const rows = db()
    .prepare(
      `SELECT n.*, COALESCE(m.p, 0) AS mastery_p
         FROM nodes n
         LEFT JOIN mastery m ON m.node_id = n.id
        WHERE n.exists_ = 1
          AND n.area = ?
          ${type ? "AND n.type = ?" : ""}
        ORDER BY ${order}`
    )
    .all(...([area, ...(type ? [type] : [])] as any[])) as BrowseNode[];
  return rows;
}

export function nodeTypes(): string[] {
  return (
    db()
      .prepare(
        `SELECT DISTINCT type FROM nodes WHERE exists_ = 1 AND type IS NOT NULL ORDER BY type`
      )
      .all() as { type: string }[]
  ).map((r) => r.type);
}

/**
 * Learning path to a target: unmastered prerequisites sorted foundations-first
 * (deepest dependency depth first = the things you need to learn before anything else).
 */
export function learningPath(targetId: string): (BrowseNode & { pdepth: number })[] {
  const rows = db()
    .prepare(
      `WITH RECURSIVE closure(id, depth, path) AS (
         SELECT dst, 1, '/' || ? || '/' || dst || '/'
           FROM edges WHERE src = ? AND type = 'depends_on'
         UNION ALL
         SELECT e.dst, c.depth + 1, c.path || e.dst || '/'
           FROM edges e
           JOIN closure c ON e.src = c.id
          WHERE e.type = 'depends_on'
            AND instr(c.path, '/' || e.dst || '/') = 0
            AND c.depth < 50
       )
       SELECT id, MAX(depth) AS depth FROM closure GROUP BY id`
    )
    .all(targetId, targetId) as { id: string; depth: number }[];

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const ph = ids.map(() => "?").join(",");
  const nodes = db()
    .prepare(
      `SELECT n.*, COALESCE(m.p, 0) AS mastery_p
         FROM nodes n
         LEFT JOIN mastery m ON m.node_id = n.id
        WHERE n.id IN (${ph}) AND n.exists_ = 1`
    )
    .all(...ids) as BrowseNode[];

  const depthMap = new Map(rows.map((r) => [r.id, r.depth]));
  return nodes
    .filter((n) => n.mastery_p < MASTERY_THRESHOLD)
    .map((n) => ({ ...n, pdepth: depthMap.get(n.id) ?? 0 }))
    .sort((a, b) => b.pdepth - a.pdepth || a.title.localeCompare(b.title));
}

/** Mastery histogram in 10-point buckets (0..9 → 0-9%, 10 → 90-99%, 11 → 100%). */
export function masteryHistogram(): { bucket: number; count: number }[] {
  const rows = db()
    .prepare(
      `SELECT CAST(COALESCE(m.p, 0) * 10 AS INTEGER) AS bucket,
              COUNT(*) AS count
         FROM nodes n
         LEFT JOIN mastery m ON m.node_id = n.id
        WHERE n.exists_ = 1
        GROUP BY bucket
        ORDER BY bucket`
    )
    .all() as { bucket: number; count: number }[];
  // fill missing buckets (CAST truncates toward zero, same as FLOOR for 0..1)
  const map = new Map(rows.map((r) => [r.bucket, r.count]));
  return Array.from({ length: 11 }, (_, i) => ({ bucket: i, count: map.get(i) ?? 0 }));
}

export type AttemptRow = {
  id: number; node_id: string; kind: string; answer: string;
  verdict: string; evidence: number; gap: string; blamed_prereq: string;
  created_at: string; mode: string; title?: string;
};

/** Distinct concepts recently practiced (deduped, most recent first). */
export function recentlyPracticed(limit = 6): (BrowseNode & { last_verdict: string; last_at: string })[] {
  return db()
    .prepare(
      `SELECT n.*, COALESCE(m.p, 0) AS mastery_p,
              a.verdict AS last_verdict, a.created_at AS last_at
         FROM (
           SELECT node_id, MAX(id) AS max_id FROM attempts GROUP BY node_id ORDER BY max_id DESC LIMIT ?
         ) AS recent
         JOIN attempts a ON a.id = recent.max_id
         JOIN nodes n ON n.id = recent.node_id
         LEFT JOIN mastery m ON m.node_id = n.id
        WHERE n.exists_ = 1
        ORDER BY recent.max_id DESC`
    )
    .all(limit) as (BrowseNode & { last_verdict: string; last_at: string })[];
}

/** Recent attempts across all concepts, with node title joined in. */
export function recentAttemptsGlobal(limit = 30): AttemptRow[] {
  return db()
    .prepare(
      `SELECT a.*, n.title
         FROM attempts a
         LEFT JOIN nodes n ON n.id = a.node_id
        ORDER BY a.id DESC
        LIMIT ?`
    )
    .all(limit) as AttemptRow[];
}

/** Weakest concepts you've actually attempted, sorted by mastery ascending. */
export function weakSpots(limit = 20): BrowseNode[] {
  return db()
    .prepare(
      `SELECT n.*, COALESCE(m.p, 0) AS mastery_p
         FROM nodes n
         JOIN mastery m ON m.node_id = n.id
        WHERE n.exists_ = 1 AND m.attempts > 0
        ORDER BY mastery_p ASC
        LIMIT ?`
    )
    .all(limit) as BrowseNode[];
}

export function searchWithMastery(q: string, limit = 25): (NodeRow & { mastery_p: number })[] {
  const safe = q.replace(/[%_]/g, "");
  const like = `%${safe}%`;
  const prefix = `${safe}%`;
  const primary = db()
    .prepare(
      `SELECT n.*, COALESCE(m.p, 0) AS mastery_p
         FROM nodes n
         LEFT JOIN mastery m ON m.node_id = n.id
        WHERE n.exists_ = 1 AND (n.title LIKE ? OR n.overview LIKE ?)
        ORDER BY CASE WHEN n.title LIKE ? THEN 0 ELSE 1 END, n.title ASC
        LIMIT ?`
    )
    .all(like, like, prefix, limit) as (NodeRow & { mastery_p: number })[];

  // If few primary hits, supplement with content matches
  if (primary.length < 5) {
    const seen = new Set(primary.map((r) => r.id));
    const secondary = db()
      .prepare(
        `SELECT n.*, COALESCE(m.p, 0) AS mastery_p
           FROM nodes n
           LEFT JOIN mastery m ON m.node_id = n.id
          WHERE n.exists_ = 1 AND n.content LIKE ?
            AND n.id NOT IN (${[...seen].map(() => "?").join(",") || "''"})
          ORDER BY n.title ASC
          LIMIT ?`
      )
      .all(like, ...[...seen], limit - primary.length) as (NodeRow & { mastery_p: number })[];
    return [...primary, ...secondary];
  }

  return primary;
}

export function search(q: string, limit = 25): NodeRow[] {
  const like = `%${q.replace(/[%_]/g, "")}%`;
  return db()
    .prepare(
      `SELECT * FROM nodes
        WHERE exists_ = 1 AND (title LIKE ? OR overview LIKE ?)
        ORDER BY CASE WHEN title LIKE ? THEN 0 ELSE 1 END, title ASC
        LIMIT ?`
    )
    .all(like, like, `${q.replace(/[%_]/g, "")}%`, limit) as NodeRow[];
}

export type LinkSuggestion = {
  src_id: string; src_title: string; src_area: string | null;
  tgt_id: string; tgt_title: string; tgt_area: string | null;
  snippet: string;
};

/** Scan note content for mentions of other concept titles with no existing edge. */
export function linkSuggestions(limit = 60): LinkSuggestion[] {
  const nodes = db()
    .prepare(`SELECT id, title, area, content FROM nodes WHERE exists_ = 1 AND content IS NOT NULL`)
    .all() as { id: string; title: string; area: string | null; content: string }[];

  const edgeSet = new Set(
    (db().prepare(`SELECT src || '|' || dst AS k FROM edges`).all() as { k: string }[]).map((r) => r.k)
  );

  const results: LinkSuggestion[] = [];

  for (const src of nodes) {
    if (!src.content || results.length >= limit) break;
    const contentLower = src.content.toLowerCase();

    for (const tgt of nodes) {
      if (tgt.id === src.id || results.length >= limit) continue;
      if (tgt.title.length < 4) continue; // skip very short titles (too noisy)
      if (edgeSet.has(`${src.id}|${tgt.id}`) || edgeSet.has(`${tgt.id}|${src.id}`)) continue;

      const idx = contentLower.indexOf(tgt.title.toLowerCase());
      if (idx === -1) continue;

      const start = Math.max(0, idx - 30);
      const end = Math.min(src.content.length, idx + tgt.title.length + 30);
      const snippet = (start > 0 ? "…" : "") + src.content.slice(start, end).trim() + (end < src.content.length ? "…" : "");

      results.push({
        src_id: src.id, src_title: src.title, src_area: src.area,
        tgt_id: tgt.id, tgt_title: tgt.title, tgt_area: tgt.area,
        snippet,
      });
    }
  }

  return results;
}

export type QualityIssue = {
  node_id: string;
  title: string;
  area: string | null;
  type: string | null;
  mastery_p: number;
  issues: string[];
  score: number; // 0-100, higher = more issues
};

export function noteQuality(): QualityIssue[] {
  const rows = db()
    .prepare(
      `SELECT n.id AS node_id, n.title, n.area, n.type,
              COALESCE(m.p, 0) AS mastery_p,
              COALESCE(LENGTH(n.content), 0) AS content_len,
              COALESCE(LENGTH(n.overview), 0) AS overview_len,
              (SELECT COUNT(*) FROM edges e WHERE e.src = n.id AND e.type = 'depends_on') AS prereq_count,
              (SELECT COUNT(*) FROM edges e2 WHERE e2.dst = n.id) AS incoming_count,
              COALESCE(m.attempts, 0) AS attempts
         FROM nodes n
         LEFT JOIN mastery m ON m.node_id = n.id
        WHERE n.exists_ = 1
        ORDER BY n.title`
    )
    .all() as {
      node_id: string; title: string; area: string | null; type: string | null;
      mastery_p: number; content_len: number; overview_len: number;
      prereq_count: number; incoming_count: number; attempts: number;
    }[];

  // "atomic" types: definitions are foundational — no prereqs expected
  const atomicTypes = new Set(["definition", "axiom", "notation", "Definition", "Axiom", "Notation", "Example", "Remark"]);

  return rows
    .map((r) => {
      const issues: string[] = [];
      let score = 0;

      if (r.content_len < 100) { issues.push("no content"); score += 40; }
      else if (r.content_len < 400) { issues.push("thin content"); score += 15; }

      if (r.overview_len === 0) { issues.push("no overview"); score += 20; }

      if (r.prereq_count === 0 && !atomicTypes.has(r.type ?? "")) {
        issues.push("no prerequisites");
        score += 10;
      }

      if (r.incoming_count === 0) { issues.push("isolated"); score += 15; }

      if (r.attempts === 0) { issues.push("never practiced"); score += 5; }

      return { ...r, issues, score };
    })
    .filter((r) => r.issues.length > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

/** Count of distinct concepts practiced today and the last N days. */
export function todayStats(): { today_concepts: number; today_attempts: number; streak_days: number } {
  const d = db();
  const today = (d.prepare(
    `SELECT COUNT(DISTINCT node_id) AS concepts, COUNT(*) AS attempts
       FROM attempts WHERE date(created_at) = date('now')`
  ).get() as any);

  // streak: longest run of consecutive days ending today
  const days = d.prepare(
    `SELECT DISTINCT date(created_at) AS day
       FROM attempts
      ORDER BY day DESC
      LIMIT 365`
  ).all() as { day: string }[];

  let streak = 0;
  for (let i = 0; i < days.length; i++) {
    const expected = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    if (days[i].day === expected) streak++;
    else break;
  }

  return {
    today_concepts: today.concepts ?? 0,
    today_attempts: today.attempts ?? 0,
    streak_days: streak,
  };
}

/** Daily attempt counts for the last 84 days (12 weeks), for the activity heatmap. */
export function activityCalendar(): { date: string; count: number }[] {
  const rows = db()
    .prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS count
         FROM attempts
        WHERE created_at >= date('now', '-84 days')
        GROUP BY day`
    )
    .all() as { day: string; count: number }[];

  const map = new Map(rows.map((r) => [r.day, r.count]));
  return Array.from({ length: 84 }, (_, i) => {
    const d = new Date(Date.now() - (83 - i) * 86400000);
    const key = d.toISOString().slice(0, 10);
    return { date: key, count: map.get(key) ?? 0 };
  });
}

/** Concepts mastered in the last 7 and 30 days (for velocity display). */
export function masteryVelocity(): { last7: number; last30: number } {
  const d = db();
  const count = (days: number) =>
    (d.prepare(
      `SELECT COUNT(*) AS n FROM mastery_history
        WHERE p >= 0.8 AND recorded_at >= date('now', '-${days} days')`
    ).get() as any).n as number;
  return { last7: count(7), last30: count(30) };
}

export function isBookmarked(nodeId: string): boolean {
  return !!db().prepare("SELECT 1 FROM bookmarks WHERE node_id = ?").get(nodeId);
}

export function toggleBookmark(nodeId: string): boolean {
  const exists = isBookmarked(nodeId);
  if (exists) {
    db().prepare("DELETE FROM bookmarks WHERE node_id = ?").run(nodeId);
    return false;
  } else {
    db().prepare("INSERT OR REPLACE INTO bookmarks(node_id) VALUES(?)").run(nodeId);
    return true;
  }
}

export function bookmarkedNodes(): BrowseNode[] {
  return db()
    .prepare(
      `SELECT n.*, COALESCE(m.p, 0) AS mastery_p
         FROM bookmarks b
         JOIN nodes n ON n.id = b.node_id
         LEFT JOIN mastery m ON m.node_id = n.id
        WHERE n.exists_ = 1
        ORDER BY b.created_at DESC`
    )
    .all() as BrowseNode[];
}

export function stats() {
  const d = db();
  const c = (sql: string) => (d.prepare(sql).get() as { c: number }).c;
  return {
    real: c("SELECT COUNT(*) c FROM nodes WHERE exists_=1"),
    ghost: c("SELECT COUNT(*) c FROM nodes WHERE exists_=0"),
    edges: c("SELECT COUNT(*) c FROM edges"),
    dependsOn: c("SELECT COUNT(*) c FROM edges WHERE type='depends_on'"),
    known: c(`SELECT COUNT(*) c FROM (${MASTERED_SUBQUERY})`),
    practiced: c("SELECT COUNT(*) c FROM attempts"),
    areas: d.prepare("SELECT area, COUNT(*) c FROM nodes WHERE exists_=1 AND area IS NOT NULL GROUP BY area ORDER BY c DESC").all() as { area: string; c: number }[],
  };
}

/**
 * Concepts in the same area as nodeId, closest mastery level first.
 * Useful for "explore similar" discovery on node pages.
 */
export function similarConcepts(
  nodeId: string,
  area: string,
  masteryP: number,
  limit = 6
): BrowseNode[] {
  return db()
    .prepare(
      `SELECT n.*, COALESCE(m.p, 0) AS mastery_p
         FROM nodes n
         LEFT JOIN mastery m ON m.node_id = n.id
        WHERE n.area = ? AND n.id != ? AND n.exists_ = 1
        ORDER BY ABS(COALESCE(m.p, 0) - ?) ASC, n.title ASC
        LIMIT ?`
    )
    .all(area, nodeId, masteryP, limit) as BrowseNode[];
}

/**
 * Returns the number of days until the next spaced-repetition review
 * (positive = future, negative = overdue, null = never practiced).
 */
export function nextReviewDays(nodeId: string): number | null {
  const row = db()
    .prepare(`SELECT last_seen, half_life FROM mastery WHERE node_id = ?`)
    .get(nodeId) as { last_seen: string | null; half_life: number } | undefined;
  if (!row || !row.last_seen) return null;
  const lastSeen = new Date(row.last_seen).getTime();
  const halfLifeMs = row.half_life * 24 * 60 * 60 * 1000;
  const dueAt = lastSeen + halfLifeMs;
  return Math.round((dueAt - Date.now()) / (24 * 60 * 60 * 1000));
}

/**
 * Cumulative mastery milestones: for each day in the last 60 days,
 * how many concepts were first mastered on or before that day.
 * Used to render a "concepts mastered over time" chart.
 */
export function masteryMilestones(): { day: string; cumulative: number }[] {
  // Find the date each concept first crossed the mastery threshold
  const firstMastered = db()
    .prepare(
      `SELECT DATE(MIN(recorded_at)) AS day, COUNT(*) AS count
         FROM (
           SELECT node_id, MIN(recorded_at) AS recorded_at
             FROM mastery_history
            WHERE p >= 0.8
            GROUP BY node_id
         )
        GROUP BY DATE(recorded_at)
        ORDER BY day ASC`
    )
    .all() as { day: string; count: number }[];

  if (firstMastered.length === 0) return [];

  // Build cumulative sum
  let cum = 0;
  return firstMastered.map((r) => {
    cum += r.count;
    return { day: r.day, cumulative: cum };
  });
}

/**
 * Per-area mastery breakdown: total concepts, mastered count, and average mastery p.
 * Used on the progress page to show subject-by-subject health.
 */
export function areaMastery(): { area: string; total: number; mastered: number; avg_p: number; practiced: number }[] {
  return db()
    .prepare(
      `SELECT
         n.area,
         COUNT(*) AS total,
         COUNT(CASE WHEN COALESCE(m.p, 0) >= 0.8 THEN 1 END) AS mastered,
         AVG(COALESCE(m.p, 0)) AS avg_p,
         COUNT(CASE WHEN COALESCE(m.attempts, 0) > 0 THEN 1 END) AS practiced
       FROM nodes n
       LEFT JOIN mastery m ON m.node_id = n.id
       WHERE n.exists_ = 1 AND n.area IS NOT NULL
       GROUP BY n.area
       ORDER BY avg_p DESC, total DESC`
    )
    .all() as { area: string; total: number; mastered: number; avg_p: number; practiced: number }[];
}

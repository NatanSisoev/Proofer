import { db, MASTERED_SUBQUERY, MASTERY_THRESHOLD, type NodeRow, type EdgeRow } from "./db";
import { getMasteryP, setKnown as masterySetKnown, P_INIT, HL_INIT, halfLifeFactor } from "./mastery";
import { hasEmbeddings, embedText } from "./llm";
import { decodeVector, cosineSimilarity } from "./vectors";
import { getExamDates } from "./settings";
import { computeStreak } from "./streak";

// The student is in Europe/Madrid, not UTC. `Date#toISOString().slice(0,10)`
// buckets by UTC day, which shifts the whole day boundary by 1-2 hours and
// can falsely break/survive a streak or reset the daily goal at 1-2am local
// time. Every JS-side day key must use this instead, matching the SQL side's
// `'localtime'` modifier.
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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
 * Prerequisite subgraph for a concept — the `depends_on` closure *under* it plus
 * the edges among that closure, for a "how to learn this" progression view.
 * Each node carries its mastery and its dependency depth (0 = the target itself,
 * larger = more foundational). Capped at `maxNodes` (nearest-depth first) so deep
 * concepts still render a legible DAG.
 */
export function prerequisiteGraph(
  id: string,
  maxNodes = 36
): {
  center: string;
  nodes: { id: string; title: string; type: string | null; exists_: number; mastery_p: number; depth: number }[];
  edges: { src: string; dst: string }[];
} {
  const rows = db()
    .prepare(
      `WITH RECURSIVE closure(id, depth, path) AS (
         SELECT dst, 1, '/' || ? || '/' || dst || '/'
           FROM edges WHERE src = ? AND type = 'depends_on'
         UNION ALL
         SELECT e.dst, c.depth + 1, c.path || e.dst || '/'
           FROM edges e JOIN closure c ON e.src = c.id
          WHERE e.type = 'depends_on'
            AND instr(c.path, '/' || e.dst || '/') = 0
            AND c.depth < 50
       )
       SELECT id, MIN(depth) AS depth FROM closure GROUP BY id
       ORDER BY depth ASC, id ASC
       LIMIT ?`
    )
    .all(id, id, maxNodes - 1) as { id: string; depth: number }[];

  const ids = [id, ...rows.map((r) => r.id)];
  const depthMap = new Map<string, number>([[id, 0], ...rows.map((r) => [r.id, r.depth] as [string, number])]);
  const ph = ids.map(() => "?").join(",");
  const nodes = db()
    .prepare(
      `SELECT n.id, n.title, n.type, n.exists_, COALESCE(m.p, 0) AS mastery_p
         FROM nodes n LEFT JOIN mastery m ON m.node_id = n.id
        WHERE n.id IN (${ph})`
    )
    .all(...ids) as { id: string; title: string; type: string | null; exists_: number; mastery_p: number }[];
  const edges = db()
    .prepare(
      `SELECT src, dst FROM edges
        WHERE type = 'depends_on' AND src <> dst AND src IN (${ph}) AND dst IN (${ph})`
    )
    .all(...ids, ...ids) as { src: string; dst: string }[];

  return {
    center: id,
    nodes: nodes.map((n) => ({ ...n, depth: depthMap.get(n.id) ?? 1 })),
    edges,
  };
}

/**
 * Readiness = fraction of the prerequisite closure you've already marked known.
 * This is the personalized signal ChatGPT structurally cannot provide.
 */
export function readiness(id: string, closure?: NodeRow[]): { score: number; known: number; total: number; missing: NodeRow[] } {
  const real = (closure ?? prerequisites(id).closure).filter((n) => n.exists_ === 1);
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
         date(m.last_seen, 'localtime', '+' || CAST(m.half_life * 0.8 AS INTEGER) || ' days') AS due_date,
         COUNT(*) AS count
         FROM mastery m
         JOIN nodes n ON n.id = m.node_id
        WHERE n.exists_ = 1 AND m.last_seen IS NOT NULL AND m.p > 0.1
          AND date(m.last_seen, 'localtime', '+' || CAST(m.half_life * 0.8 AS INTEGER) || ' days') >= date('now', 'localtime')
          AND date(m.last_seen, 'localtime', '+' || CAST(m.half_life * 0.8 AS INTEGER) || ' days') < date('now', 'localtime', '+8 days')
        GROUP BY due_date
        ORDER BY due_date`
    )
    .all() as { due_date: string; count: number }[];

  // Fill all 8 days, even those with 0 reviews
  const map = new Map(rows.map((r) => [r.due_date, r.count]));
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date(Date.now() + i * 86400000);
    const key = localDateStr(d);
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
): { id: number; problem: string; kind: string | null; verdict: string; gap: string | null; created_at: string; trust: string | null }[] {
  return db()
    .prepare(
      `SELECT id, problem, kind, verdict, gap, created_at, trust
         FROM attempts
        WHERE node_id = ? AND problem IS NOT NULL AND problem != ''
        ORDER BY id DESC
        LIMIT ?`
    )
    .all(nodeId, limit) as any[];
}

export type AttemptDetail = {
  id: number;
  node_id: string;
  node_title: string | null;
  node_type: string | null;
  node_area: string | null;
  kind: string | null;
  problem: string;
  answer: string;
  verdict: string;
  evidence: number;
  gap: string | null;
  blamed_prereq: string | null;
  created_at: string;
  mode: string;
  trust: string | null;
  problem_id: number | null; // null on attempts recorded before this column existed — can't be reopened for a redo
};

/** A single attempt with its concept joined in, for the /attempt/[id] review page.
 *  Does NOT expose the ideal_solution/rubric (stays server-side, fetched fresh
 *  at grade time by problem_id — same rule as the live practice flow). */
export function getAttempt(id: number): AttemptDetail | undefined {
  return db()
    .prepare(
      `SELECT a.id, a.node_id, n.title AS node_title, n.type AS node_type, n.area AS node_area,
              a.kind, a.problem, a.answer, a.verdict, a.evidence, a.gap, a.blamed_prereq,
              a.created_at, a.mode, a.trust, a.problem_id
         FROM attempts a
         LEFT JOIN nodes n ON n.id = a.node_id
        WHERE a.id = ?`
    )
    .get(id) as AttemptDetail | undefined;
}

export type WeakPrerequisite = {
  prereq: string;            // the blamed prerequisite (a node id)
  blame_count: number;       // total attempts that blamed it
  concept_count: number;     // distinct downstream concepts it was blamed for
  concepts: string;          // comma-joined sample of those downstream concept ids
  exists_: number;           // 1 if the prereq has its own note, 0 if it's a ghost
  mastery_p: number;         // current mastery of the prerequisite itself
};

/**
 * Cross-concept misconception signal: prerequisites that the grader has blamed
 * across MULTIPLE distinct downstream concepts. A single weak foundation that
 * keeps surfacing as the root cause of unrelated errors is the highest-leverage
 * thing to fix — practising it lifts every concept that depends on it. This is
 * the single-user seed of the misconception dataset VISION.md describes.
 */
export function recurringWeakPrerequisites(limit = 8): WeakPrerequisite[] {
  return db()
    .prepare(
      `SELECT a.blamed_prereq AS prereq,
              COUNT(*) AS blame_count,
              COUNT(DISTINCT a.node_id) AS concept_count,
              GROUP_CONCAT(DISTINCT a.node_id) AS concepts,
              COALESCE(n.exists_, 0) AS exists_,
              COALESCE(m.p, 0) AS mastery_p
         FROM attempts a
         LEFT JOIN nodes n ON n.id = a.blamed_prereq
         LEFT JOIN mastery m ON m.node_id = a.blamed_prereq
        WHERE a.blamed_prereq IS NOT NULL
          AND a.blamed_prereq != ''
          AND a.blamed_prereq != 'none'
        GROUP BY a.blamed_prereq
       HAVING concept_count >= 2
        ORDER BY concept_count DESC, blame_count DESC
        LIMIT ?`
    )
    .all(limit) as WeakPrerequisite[];
}

export type NodeBlamedPrereq = {
  prereq: string;       // blamed prerequisite node id
  blame_count: number;  // times it was blamed for THIS node specifically
  exists_: number;      // 1 if the prereq has its own note, 0 if ghost
  mastery_p: number;    // current mastery of the prerequisite
};

/**
 * Per-node misconception signal: which prerequisites the grader blamed most
 * often in failed/partial attempts on a SINGLE concept. Unlike
 * recurringWeakPrerequisites (which looks cross-concept), this is the
 * node-level view — "when you struggle with THIS concept, what's the
 * underlying gap?" Shown on the node page so the student knows exactly
 * which prerequisite to revisit before retrying.
 */
export function nodeBlamedPrereqs(nodeId: string, limit = 3): NodeBlamedPrereq[] {
  return db()
    .prepare(
      `SELECT a.blamed_prereq AS prereq,
              COUNT(*) AS blame_count,
              COALESCE(n.exists_, 0) AS exists_,
              COALESCE(m.p, 0) AS mastery_p
         FROM attempts a
         LEFT JOIN nodes n ON n.id = a.blamed_prereq
         LEFT JOIN mastery m ON m.node_id = a.blamed_prereq
        WHERE a.node_id = ?
          AND a.blamed_prereq IS NOT NULL
          AND a.blamed_prereq != ''
          AND a.blamed_prereq != 'none'
          AND a.verdict IN ('partial', 'incorrect')
        GROUP BY a.blamed_prereq
        ORDER BY blame_count DESC
        LIMIT ?`
    )
    .all(nodeId, limit) as NodeBlamedPrereq[];
}

// ===========================================================================
// Misconception clustering (VISION.md bet #2, MVP slice) — an LLM batch pass
// groups a concept's gap texts into named recurring misconceptions, reviewed
// via /quality, then saved here for display on the node page.
// ===========================================================================
export type MisconceptionCandidate = {
  id: string; title: string; type: string | null; area: string | null;
  gap_count: number;      // eligible gap texts (partial/incorrect, non-empty)
  existing_count: number; // already-saved clusters for this node
};

/** Concepts with enough failed/partial attempts to look for a recurring
 *  misconception. Thin today (36 attempts vault-wide) — most concepts won't
 *  qualify, which is expected; this is the on-ramp, not a mature dataset. */
export function misconceptionCandidates(minGaps = 2, limit = 50): MisconceptionCandidate[] {
  return db()
    .prepare(
      `SELECT n.id, n.title, n.type, n.area,
              COUNT(*) AS gap_count,
              (SELECT COUNT(*) FROM misconceptions mc WHERE mc.node_id = n.id) AS existing_count
         FROM attempts a
         JOIN nodes n ON n.id = a.node_id
        WHERE a.verdict IN ('partial', 'incorrect')
          AND a.gap IS NOT NULL AND a.gap != ''
          AND n.exists_ = 1
        GROUP BY a.node_id
       HAVING gap_count >= ?
        ORDER BY gap_count DESC
        LIMIT ?`
    )
    .all(minGaps, limit) as MisconceptionCandidate[];
}

/** The gap texts to feed the clustering LLM call for one concept. */
export function gapsForNode(nodeId: string, limit = 20): string[] {
  return (
    db()
      .prepare(
        `SELECT gap FROM attempts
          WHERE node_id = ? AND verdict IN ('partial', 'incorrect')
            AND gap IS NOT NULL AND gap != ''
          ORDER BY id DESC
          LIMIT ?`
      )
      .all(nodeId, limit) as { gap: string }[]
  ).map((r) => r.gap);
}

export type SavedMisconception = { id: number; label: string; gap_count: number; created_at: string };

/** Saved misconception clusters for one concept, strongest (most gaps) first. */
export function misconceptionsForNode(nodeId: string): SavedMisconception[] {
  return db()
    .prepare(`SELECT id, label, gap_count, created_at FROM misconceptions WHERE node_id = ? ORDER BY gap_count DESC, id DESC`)
    .all(nodeId) as SavedMisconception[];
}

/** Replace a concept's saved clusters with a fresh analysis result — a
 *  best-effort snapshot (re-running supersedes, doesn't accumulate). */
export function saveMisconceptions(nodeId: string, clusters: { label: string; gap_count: number }[]): void {
  const d = db();
  d.prepare(`DELETE FROM misconceptions WHERE node_id = ?`).run(nodeId);
  const ins = d.prepare(`INSERT INTO misconceptions (node_id, label, gap_count) VALUES (?, ?, ?)`);
  for (const c of clusters) ins.run(nodeId, c.label, c.gap_count);
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

export type BrowseArea = { area: string; count: number; avg_mastery: number; mastered: number };
export type BrowseNode = NodeRow & { mastery_p: number };

export function browseAreas(): BrowseArea[] {
  return db()
    .prepare(
      `SELECT n.area,
              COUNT(*) AS count,
              AVG(COALESCE(m.p, 0)) AS avg_mastery,
              SUM(CASE WHEN COALESCE(m.p, 0) >= ${MASTERY_THRESHOLD} THEN 1 ELSE 0 END) AS mastered
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

export function allNodesWithMastery(
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
          ${type ? "AND n.type = ?" : ""}
        ORDER BY ${order}`
    )
    .all(...(type ? [type] : [])) as BrowseNode[];
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
  trust: string | null;
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

export type HistoryAttempt = {
  id: number; node_id: string; kind: string | null; verdict: string;
  problem: string | null; gap: string | null; created_at: string;
  title: string | null; area: string | null; type: string | null;
  trust: string | null;
};

export type HistoryFilters = {
  verdict?: string;
  area?: string;
  kind?: string;
  page?: number;
  perPage?: number;
};

/**
 * Paginated attempt history with optional filters.
 * Returns rows + total count for pagination controls.
 */
export function attemptHistory(
  opts: HistoryFilters = {}
): { rows: HistoryAttempt[]; total: number } {
  const { verdict, area, kind, page = 1, perPage = 25 } = opts;
  const offset = (page - 1) * perPage;

  const wheres: string[] = [];
  const params: (string | number)[] = [];
  if (verdict) { wheres.push("a.verdict = ?"); params.push(verdict); }
  if (area)    { wheres.push("n.area = ?");    params.push(area); }
  if (kind)    { wheres.push("a.kind = ?");    params.push(kind); }
  const where = wheres.length > 0 ? `WHERE ${wheres.join(" AND ")}` : "";

  const total = (db()
    .prepare(
      `SELECT COUNT(*) AS n
         FROM attempts a
         LEFT JOIN nodes n ON n.id = a.node_id
        ${where}`
    )
    .get(...params) as { n: number }).n;

  const rows = db()
    .prepare(
      `SELECT a.id, a.node_id, a.kind, a.verdict, a.problem, a.gap, a.created_at, a.trust,
              n.title, n.area, n.type
         FROM attempts a
         LEFT JOIN nodes n ON n.id = a.node_id
        ${where}
        ORDER BY a.id DESC
        LIMIT ? OFFSET ?`
    )
    .all(...params, perPage, offset) as HistoryAttempt[];

  return { rows, total };
}

/** Distinct problem kinds found in the attempts table (for filter UI). */
export function attemptKinds(): string[] {
  return (
    db()
      .prepare(`SELECT DISTINCT kind FROM attempts WHERE kind IS NOT NULL ORDER BY kind`)
      .all() as { kind: string }[]
  ).map((r) => r.kind);
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

// Subquery counting direct unmastered prerequisites for a node.
// Used in search to surface readiness ("ready" vs "N prereqs away").
const DIRECT_UNMASTERED_SQ = `(
  SELECT COUNT(*) FROM edges e
  LEFT JOIN mastery pm ON pm.node_id = e.dst
  WHERE e.src = n.id AND e.type = 'depends_on'
    AND COALESCE(pm.p, 0) < ${MASTERY_THRESHOLD}
) AS direct_unmastered_prereqs`;

// Escape LIKE wildcards (%, _) and the escape char itself so a literal
// search term like "a_n" or "100%" matches literally instead of the
// underscore/percent acting as a single-char/any-chars wildcard.
function escapeLike(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function searchWithMastery(q: string, limit = 25): (NodeRow & { mastery_p: number; direct_unmastered_prereqs: number })[] {
  const esc = escapeLike(q);
  const like = `%${esc}%`;
  const prefix = `${esc}%`;
  const primary = db()
    .prepare(
      `SELECT n.*, COALESCE(m.p, 0) AS mastery_p, ${DIRECT_UNMASTERED_SQ}
         FROM nodes n
         LEFT JOIN mastery m ON m.node_id = n.id
        WHERE n.exists_ = 1 AND (n.title LIKE ? ESCAPE '\\' OR n.overview LIKE ? ESCAPE '\\')
        ORDER BY CASE
          WHEN lower(n.title) = lower(?) THEN 0
          WHEN n.title LIKE ? ESCAPE '\\' THEN 1
          ELSE 2
        END, n.title ASC
        LIMIT ?`
    )
    .all(like, like, q, prefix, limit) as (NodeRow & { mastery_p: number; direct_unmastered_prereqs: number })[];

  // If few primary hits, supplement with content matches
  if (primary.length < 5) {
    const seen = new Set(primary.map((r) => r.id));
    const secondary = db()
      .prepare(
        `SELECT n.*, COALESCE(m.p, 0) AS mastery_p, ${DIRECT_UNMASTERED_SQ}
           FROM nodes n
           LEFT JOIN mastery m ON m.node_id = n.id
          WHERE n.exists_ = 1 AND n.content LIKE ? ESCAPE '\\'
            AND n.id NOT IN (${[...seen].map(() => "?").join(",") || "''"})
          ORDER BY n.title ASC
          LIMIT ?`
      )
      .all(like, ...[...seen], limit - primary.length) as (NodeRow & { mastery_p: number; direct_unmastered_prereqs: number })[];
    return [...primary, ...secondary];
  }

  return primary;
}

type SearchHit = NodeRow & { mastery_p: number; direct_unmastered_prereqs: number };

const SEMANTIC_MATCH_THRESHOLD = 0.55; // conservative — below this, cosine hits are noise, not paraphrase recall

function loadAllEmbeddings(): Map<string, Float32Array> {
  const rows = db().prepare("SELECT node_id, vector FROM embeddings").all() as { node_id: string; vector: Buffer }[];
  return new Map(rows.map((r) => [r.node_id, decodeVector(r.vector)]));
}

/**
 * Cycle 2 #3's first consumer: searchWithMastery stays exact/prefix/substring
 * (fast, synchronous, unchanged). This wraps it and — ONLY when those hits
 * are thin AND an embedding key is configured — adds a semantic recall pass
 * (paraphrases, notation variants) ranked by cosine similarity. Never used on
 * the SSR /explore page load, only the live typeahead (`/api/search`), since
 * it's the one surface that can tolerate an embedding API round-trip.
 */
export async function searchHybrid(q: string, limit = 25): Promise<SearchHit[]> {
  const primary = searchWithMastery(q, limit);
  if (primary.length >= 5 || !hasEmbeddings()) return primary;

  try {
    const [queryVector] = await embedText([q]);
    if (!queryVector) return primary;
    const qv = Float32Array.from(queryVector);
    const embeddings = loadAllEmbeddings();
    const seen = new Set(primary.map((r) => r.id));

    const scored = [...embeddings.entries()]
      .filter(([id]) => !seen.has(id))
      .map(([id, vec]) => ({ id, score: cosineSimilarity(qv, vec) }))
      .filter((s) => s.score >= SEMANTIC_MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit - primary.length);
    if (scored.length === 0) return primary;

    const topIds = scored.map((s) => s.id);
    const rows = db()
      .prepare(
        `SELECT n.*, COALESCE(m.p, 0) AS mastery_p, ${DIRECT_UNMASTERED_SQ}
           FROM nodes n
           LEFT JOIN mastery m ON m.node_id = n.id
          WHERE n.exists_ = 1 AND n.id IN (${topIds.map(() => "?").join(",")})`
      )
      .all(...topIds) as SearchHit[];

    // Re-order to match cosine ranking — SQL's IN(...) doesn't preserve it.
    const byId = new Map(rows.map((r) => [r.id, r]));
    const semantic = topIds.map((id) => byId.get(id)).filter((r): r is SearchHit => !!r);
    return [...primary, ...semantic];
  } catch {
    return primary; // embeddings are a bonus recall layer — never break search
  }
}

export function search(q: string, limit = 25): NodeRow[] {
  const esc = escapeLike(q);
  const like = `%${esc}%`;
  return db()
    .prepare(
      `SELECT * FROM nodes
        WHERE exists_ = 1 AND (title LIKE ? ESCAPE '\\' OR overview LIKE ? ESCAPE '\\')
        ORDER BY CASE WHEN title LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, title ASC
        LIMIT ?`
    )
    .all(like, like, `${esc}%`, limit) as NodeRow[];
}

export type RelatedEdge = {
  src_id: string;   src_title: string;  src_type: string | null; src_area: string | null; src_overview: string | null;
  tgt_id: string;   tgt_title: string;  tgt_type: string | null; tgt_area: string | null; tgt_overview: string | null;
  context: string | null;
};

/**
 * All `related` edges between existing nodes, with both node's titles and overviews
 * so an LLM (or user) can classify them into more specific types.
 * Sorted by shared area first (same-area pairs are the easiest to reclassify).
 */
export function relatedEdgesWithNodes(limit = 100): RelatedEdge[] {
  return db()
    .prepare(
      `SELECT
         e.src AS src_id, sn.title AS src_title, sn.type AS src_type, sn.area AS src_area, sn.overview AS src_overview,
         e.dst AS tgt_id, tn.title AS tgt_title, tn.type AS tgt_type, tn.area AS tgt_area, tn.overview AS tgt_overview,
         e.context
       FROM edges e
       JOIN nodes sn ON sn.id = e.src AND sn.exists_ = 1
       JOIN nodes tn ON tn.id = e.dst AND tn.exists_ = 1
       WHERE e.type = 'related'
       ORDER BY (sn.area = tn.area) DESC, sn.area ASC, sn.title ASC
       LIMIT ?`
    )
    .all(limit) as RelatedEdge[];
}

/**
 * Count of unclassified `related` edges between existing nodes — used for the /quality badge.
 */
export function relatedEdgeCount(): number {
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS n FROM edges e
        JOIN nodes sn ON sn.id = e.src AND sn.exists_ = 1
        JOIN nodes tn ON tn.id = e.dst AND tn.exists_ = 1
       WHERE e.type = 'related'`
    )
    .get() as { n: number };
  return row.n;
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

export type DependencyCycle = {
  nodes: string[];   // node ids forming the cycle (in traversal order, no repeat of the closing node)
  mutual: boolean;   // true for a 2-cycle A→B→A (mutual prerequisites — the clearest error)
};

/**
 * Canonicalise a cycle: rotate so the lexicographically smallest id leads,
 * then key by the joined path so rotations of the same cycle collapse to one
 * entry. Pure (no DB access) so it's unit-testable directly.
 */
export function canonicalizeCycle(path: string[]): { rotated: string[]; key: string } {
  let min = 0;
  for (let i = 1; i < path.length; i++) if (path[i] < path[min]) min = i;
  const rotated = path.slice(min).concat(path.slice(0, min));
  return { rotated, key: rotated.join("\u0000") };
}

/**
 * Detect cycles in the `depends_on` graph. A cycle means "A is a prerequisite
 * of B and B is (transitively) a prerequisite of A" — a contradiction that
 * corrupts the readiness/frontier model (you can never be "ready" for either).
 * `prerequisites()` is already cycle-safe via path tracking, so this is purely
 * a reporting view for /quality. Cycles are canonicalised (rotated to start at
 * the smallest id) and deduped, then returned shortest-first.
 */
export function dependencyCycles(limit = 40): DependencyCycle[] {
  const edges = db()
    .prepare(`SELECT src, dst FROM edges WHERE type = 'depends_on'`)
    .all() as { src: string; dst: string }[];

  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.src)) adj.set(e.src, []);
    adj.get(e.src)!.push(e.dst);
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];
  const seen = new Set<string>();
  const cycles: DependencyCycle[] = [];

  function record(path: string[]) {
    const { rotated, key } = canonicalizeCycle(path);
    if (seen.has(key)) return;
    seen.add(key);
    cycles.push({ nodes: rotated, mutual: rotated.length === 2 });
  }

  function dfs(u: string) {
    color.set(u, GRAY);
    stack.push(u);
    for (const v of adj.get(u) ?? []) {
      const c = color.get(v) ?? WHITE;
      if (c === WHITE) dfs(v);
      else if (c === GRAY) {
        const idx = stack.indexOf(v);
        if (idx !== -1) record(stack.slice(idx));
      }
    }
    stack.pop();
    color.set(u, BLACK);
  }

  for (const u of adj.keys()) {
    if ((color.get(u) ?? WHITE) === WHITE) dfs(u);
  }

  return cycles
    .sort((a, b) => a.nodes.length - b.nodes.length || a.nodes[0].localeCompare(b.nodes[0]))
    .slice(0, limit);
}

/** Count of distinct concepts practiced today and the last N days. */
export function todayStats(): {
  today_concepts: number;
  today_attempts: number;
  streak_days: number;
  freezes_available: number;
  freezes_used_just_now: string[];
} {
  const d = db();
  const today = (d.prepare(
    `SELECT COUNT(DISTINCT node_id) AS concepts, COUNT(*) AS attempts
       FROM attempts WHERE date(created_at, 'localtime') = date('now', 'localtime')`
  ).get() as any);

  // streak: longest run of consecutive days ending today (or yesterday, if the
  // student hasn't practiced yet today — the streak is still alive until
  // midnight), transparently bridging gaps with a banked "freeze" token when
  // one is available (Cycle 2 #7 "streak insurance") — see lib/streak.ts.
  const days = d.prepare(
    `SELECT DISTINCT date(created_at, 'localtime') AS day
       FROM attempts
      ORDER BY day DESC
      LIMIT 365`
  ).all() as { day: string }[];
  const { streakDays, freezesAvailable, freezesUsedJustNow } = computeStreak(new Set(days.map((r) => r.day)));

  return {
    today_concepts: today.concepts ?? 0,
    today_attempts: today.attempts ?? 0,
    streak_days: streakDays,
    freezes_available: freezesAvailable,
    freezes_used_just_now: freezesUsedJustNow,
  };
}

/** Daily attempt counts for the last 84 days (12 weeks), for the activity heatmap. */
export function activityCalendar(): { date: string; count: number }[] {
  const rows = db()
    .prepare(
      `SELECT date(created_at, 'localtime') AS day, COUNT(*) AS count
         FROM attempts
        WHERE created_at >= date('now', 'localtime', '-84 days')
        GROUP BY day`
    )
    .all() as { day: string; count: number }[];

  const map = new Map(rows.map((r) => [r.day, r.count]));
  return Array.from({ length: 84 }, (_, i) => {
    const d = new Date(Date.now() - (83 - i) * 86400000);
    const key = localDateStr(d);
    return { date: key, count: map.get(key) ?? 0 };
  });
}

/** Concepts mastered in the last 7 and 30 days (for velocity display).
 *  Counts DISTINCT concepts whose very first mastery-threshold crossing (p≥0.8)
 *  falls within the window — repeated practice on already-mastered concepts
 *  is NOT counted again.
 */
const AVG_PACE_FALLBACK_SEC = 240; // ~4 min/problem — used until there's real tracked data
const AVG_PACE_MIN_SAMPLE = 5;

/**
 * Cycle 2 #7 "time-boxed sessions": median wall-clock seconds spent per
 * problem over your last 50 timed attempts, so SessionSetup can turn "give
 * me 20 minutes" into a concept count from your own pace instead of a
 * generic guess. Median (not mean) so one 20-minute proof you got up and
 * walked away from doesn't blow out the estimate for everything else.
 * Give-up ("I don't know") attempts never get an elapsed_sec, so they're
 * automatically excluded — they're not representative solving pace.
 */
export function avgSecondsPerProblem(): { seconds: number; sample: number } {
  const rows = db()
    .prepare(
      `SELECT elapsed_sec FROM attempts
        WHERE elapsed_sec IS NOT NULL
        ORDER BY id DESC
        LIMIT 50`
    )
    .all() as { elapsed_sec: number }[];

  if (rows.length < AVG_PACE_MIN_SAMPLE) {
    return { seconds: AVG_PACE_FALLBACK_SEC, sample: rows.length };
  }
  const sorted = rows.map((r) => r.elapsed_sec).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return { seconds: Math.round(median), sample: rows.length };
}

export function masteryVelocity(): { last7: number; last30: number } {
  const d = db();
  const count = (days: number) =>
    (d.prepare(
      `SELECT COUNT(*) AS n
         FROM (
           SELECT node_id, MIN(recorded_at) AS first_mastered
             FROM mastery_history
            WHERE p >= ${MASTERY_THRESHOLD}
            GROUP BY node_id
         )
        WHERE date(first_mastered, 'localtime') >= date('now', 'localtime', '-${days} days')`
    ).get() as any).n as number;
  return { last7: count(7), last30: count(30) };
}

export type RetentionBucket = {
  bucket: string;        // "0–20%" — predicted-recall range this bucket covers
  predictedAvg: number;  // average predicted recall of pairs in this bucket
  actualRate: number;    // observed pass rate (verdict === "correct") of pairs in this bucket
  n: number;
};

export type RetentionCalibration = {
  n: number;                 // total qualifying (predicted, actual) pairs found
  ready: boolean;            // n >= RETENTION_MIN_SAMPLE — enough to draw a curve, not noise
  buckets: RetentionBucket[]; // only populated when ready
  bias: number | null;       // mean(actual - predicted); >0 the model under-predicts recall
                              // (half-life could run longer), <0 it over-predicts (should be shorter)
};

// Below this many transitions, a calibration curve is mostly noise — the
// panel says "collecting data" instead of drawing one. ~40 total attempts
// today yields ~23 transitions (most nodes only have one attempt so far,
// contributing no transition), comfortably under this bar.
export const RETENTION_MIN_SAMPLE = 30;

/**
 * Cycle 2 #6: is the hand-tuned half-life rule (×2 correct, ×0.5 incorrect,
 * ×1.2 partial) actually predicting recall well? For every attempt that
 * follows an earlier one on the SAME node, treat the earlier attempt as "the
 * last review" and check whether `0.5^(days_elapsed / half_life)` — the
 * predicted probability of still remembering it — matches whether this
 * attempt was actually graded correct.
 *
 * There's no stored history of each node's half-life over time (only the
 * current value), so this replays it from scratch: half-life is a pure
 * function of the evidence sequence (HL_INIT, then ×halfLifeFactor(evidence)
 * per attempt, clamped 1..365 — identical math to lib/mastery.ts#applyAttempt),
 * so walking each node's attempts in order reconstructs the exact sequence
 * that produced today's stored half-life. The one gap: a manual "mark known"
 * (lib/mastery.ts#setKnown) also bumps half-life but isn't an attempts row,
 * so it's invisible to this replay — an accepted, rare edge case for what's
 * explicitly a diagnostic panel, not a source of truth.
 */
export function retentionCalibration(): RetentionCalibration {
  const rows = db()
    .prepare(
      `SELECT node_id, verdict, evidence, created_at
         FROM attempts
        WHERE created_at IS NOT NULL AND evidence IS NOT NULL
        ORDER BY node_id ASC, created_at ASC, id ASC`
    )
    .all() as { node_id: string; verdict: string; evidence: number; created_at: string }[];

  const pairs: { predicted: number; actual: number }[] = [];
  let currentNode: string | null = null;
  let halfLife = HL_INIT;
  let prevTime: number | null = null;

  for (const r of rows) {
    if (r.node_id !== currentNode) {
      currentNode = r.node_id;
      halfLife = HL_INIT;
      prevTime = null;
    }
    const t = new Date(r.created_at).getTime();
    if (prevTime !== null && Number.isFinite(t) && t >= prevTime) {
      const daysElapsed = (t - prevTime) / 86_400_000;
      const predicted = Math.pow(0.5, daysElapsed / halfLife);
      const actual = r.verdict === "correct" ? 1 : 0;
      pairs.push({ predicted, actual });
    }
    halfLife = Math.max(1, Math.min(365, halfLife * halfLifeFactor(r.evidence)));
    prevTime = t;
  }

  if (pairs.length < RETENTION_MIN_SAMPLE) {
    return { n: pairs.length, ready: false, buckets: [], bias: null };
  }

  const LABELS = ["0–20%", "20–40%", "40–60%", "60–80%", "80–100%"];
  const sums = LABELS.map(() => ({ predictedSum: 0, actualSum: 0, n: 0 }));
  let biasSum = 0;

  for (const p of pairs) {
    const idx = Math.min(LABELS.length - 1, Math.floor(p.predicted * LABELS.length));
    sums[idx].predictedSum += p.predicted;
    sums[idx].actualSum += p.actual;
    sums[idx].n += 1;
    biasSum += p.actual - p.predicted;
  }

  const buckets: RetentionBucket[] = LABELS.map((label, i) => ({
    bucket: label,
    predictedAvg: sums[i].n > 0 ? sums[i].predictedSum / sums[i].n : 0,
    actualRate: sums[i].n > 0 ? sums[i].actualSum / sums[i].n : 0,
    n: sums[i].n,
  })).filter((b) => b.n > 0);

  return { n: pairs.length, ready: true, buckets, bias: biasSum / pairs.length };
}

export type ExamPacing = {
  scopeKey: string;      // "area:Topology" — the settings key this target is stored under
  scopeType: "area" | "source";
  scopeValue: string;    // "Topology"
  examDate: string;      // "YYYY-MM-DD"
  daysLeft: number;      // negative once the date has passed
  total: number;         // concepts in scope
  unmastered: number;
  requiredPace: number;  // concepts/day still needed to finish by examDate
  actualPace: number;    // concepts/day mastered in the last 7 days, scoped
  behind: boolean;
};

/** Cycle 2 #4c: days-left / required-pace / actual-pace for each exam target
 *  the student has set (lib/settings.ts#getExamDates). Scoped to "area" only
 *  today — "source" targets are accepted by the data model but there's no
 *  source-scoped session mode yet to drill into, so the UI doesn't offer it. */
export function examPacing(): ExamPacing[] {
  const dates = getExamDates();
  const today = db().prepare("SELECT date('now','localtime') AS d").get() as { d: string };
  const targets: ExamPacing[] = [];

  for (const [scopeKey, examDate] of Object.entries(dates)) {
    const sep = scopeKey.indexOf(":");
    if (sep < 0) continue;
    const scopeType = scopeKey.slice(0, sep);
    const scopeValue = scopeKey.slice(sep + 1);
    if ((scopeType !== "area" && scopeType !== "source") || !scopeValue || !examDate) continue;
    const col = scopeType === "area" ? "n.area" : "n.source";

    const totals = db()
      .prepare(
        `SELECT COUNT(*) AS total,
                COUNT(CASE WHEN COALESCE(m.p, 0) >= ${MASTERY_THRESHOLD} THEN 1 END) AS mastered
           FROM nodes n
           LEFT JOIN mastery m ON m.node_id = n.id
          WHERE n.exists_ = 1 AND ${col} = ?`
      )
      .get(scopeValue) as { total: number; mastered: number };

    const last7 = (
      db()
        .prepare(
          `SELECT COUNT(*) AS n FROM (
             SELECT mh.node_id, MIN(mh.recorded_at) AS first_mastered
               FROM mastery_history mh
               JOIN nodes n ON n.id = mh.node_id
              WHERE mh.p >= ${MASTERY_THRESHOLD} AND ${col} = ?
              GROUP BY mh.node_id
           )
           WHERE date(first_mastered, 'localtime') >= date('now', 'localtime', '-7 days')`
        )
        .get(scopeValue) as { n: number }
    ).n;

    const daysLeft = Math.ceil(
      (new Date(examDate + "T12:00:00").getTime() - new Date(today.d + "T12:00:00").getTime()) / 86400000
    );
    const unmastered = totals.total - totals.mastered;
    const actualPace = last7 / 7;
    const requiredPace = daysLeft > 0 ? unmastered / daysLeft : unmastered > 0 ? Infinity : 0;

    targets.push({
      scopeKey,
      scopeType,
      scopeValue,
      examDate,
      daysLeft,
      total: totals.total,
      unmastered,
      requiredPace,
      actualPace,
      behind: unmastered > 0 && actualPace < requiredPace,
    });
  }

  return targets.sort((a, b) => a.daysLeft - b.daysLeft);
}

export type Calibration = {
  n: number;                 // attempts that carried a confidence prediction
  brier: number | null;      // mean (predicted - actual)^2; lower = better calibrated
  bias: number | null;       // mean (predicted - actual); >0 overconfident, <0 underconfident
  overconfident: { node_id: string; title: string; n: number; overconf: number }[];
};

// How well the student's pre-answer confidence matches reality. `actual` maps a
// verdict to a score (correct=1, partial=0.5, incorrect=0); the Brier score is
// the mean squared error between predicted confidence and that outcome, and the
// signed bias says whether they systematically over- or under-rate themselves.
// Only attempts where the student gave a prediction count. This is the
// "refuses to let you fool yourself" instrument made into a number.
const ACTUAL_CASE = "CASE verdict WHEN 'correct' THEN 1.0 WHEN 'partial' THEN 0.5 ELSE 0.0 END";

export type OverconfidentConcept = NodeRow & { mastery_p: number; n: number; overconf: number };

// Concepts the student rates higher than their results justify — predicted
// confidence systematically above the realized verdict (n>=2 so it isn't one
// fluke). These are the highest-value practice targets: the tutor's job is to
// stop you fooling yourself, and this is exactly where belief and reality split.
export function overconfidentConcepts(limit = 20): OverconfidentConcept[] {
  const overconfExpr = `AVG(a.predicted_correct - (${ACTUAL_CASE.replace(/verdict/g, "a.verdict")}))`;
  return db()
    .prepare(
      `SELECT nd.*,
              COALESCE(m.p, 0) AS mastery_p,
              COUNT(*) AS n,
              ${overconfExpr} AS overconf
         FROM attempts a
         JOIN nodes nd ON nd.id = a.node_id
         LEFT JOIN mastery m ON m.node_id = a.node_id
        WHERE a.predicted_correct IS NOT NULL
          AND nd.exists_ = 1
        GROUP BY a.node_id
       HAVING COUNT(*) >= 2 AND ${overconfExpr} > 0.15
        ORDER BY overconf DESC
        LIMIT ?`
    )
    .all(limit) as OverconfidentConcept[];
}

export function calibration(): Calibration {
  const overall = db()
    .prepare(
      `SELECT COUNT(*) AS n,
              AVG((predicted_correct - act) * (predicted_correct - act)) AS brier,
              AVG(predicted_correct - act) AS bias
         FROM (
           SELECT predicted_correct, ${ACTUAL_CASE} AS act
             FROM attempts
            WHERE predicted_correct IS NOT NULL
         )`
    )
    .get() as { n: number; brier: number | null; bias: number | null };

  const overconfident = overconfidentConcepts(6).map((c) => ({
    node_id: c.id,
    title: c.title,
    n: c.n,
    overconf: c.overconf,
  }));

  return {
    n: overall.n,
    brier: overall.n > 0 ? overall.brier : null,
    bias: overall.n > 0 ? overall.bias : null,
    overconfident,
  };
}

export type GradingTrust = {
  checked: number;              // adversarially cross-checked attempts (cross-checked + refuted)
  refuted: number;               // of those, how many the adversarial pass actually broke
  disagreementRate: number | null; // refuted / checked — the honest single-pass-grading failure rate
};

// Cycle 2 #2b: how often the adversarial second pass (grade/route.ts) actually
// finds a hole in an answer the primary grader already called "correct". This
// is the measurable justification for running rubric grading + a refuter at
// all — see IMPROVEMENT_PLAN.md Cycle 2 #2.
export function gradingTrustStats(): GradingTrust {
  const row = db()
    .prepare(
      `SELECT
         SUM(CASE WHEN trust IN ('cross-checked', 'refuted') THEN 1 ELSE 0 END) AS checked,
         SUM(CASE WHEN trust = 'refuted' THEN 1 ELSE 0 END) AS refuted
       FROM attempts`
    )
    .get() as { checked: number | null; refuted: number | null };
  const checked = row.checked ?? 0;
  const refuted = row.refuted ?? 0;
  return { checked, refuted, disagreementRate: checked > 0 ? refuted / checked : null };
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

/**
 * Pick the "concept of the day" — rotates daily through interesting concepts.
 * Prefers frontier concepts with content; falls back to any real concept.
 * Uses day-of-year mod count for deterministic daily rotation.
 */
export function conceptOfDay(): (BrowseNode & { has_content: number; reason: "frontier" | "unmastered" }) | null {
  const dayIdx = Math.floor(Date.now() / 86400000); // days since epoch

  // Try frontier first (all prereqs known, has content)
  const frontierWhere = `
    WHERE n.exists_ = 1
      AND LENGTH(COALESCE(n.content,'')) > 100
      AND n.id NOT IN (${MASTERED_SUBQUERY})
      AND NOT EXISTS (
        SELECT 1 FROM edges e
         WHERE e.src = n.id AND e.type = 'depends_on'
           AND e.dst <> n.id
           AND e.dst NOT IN (${MASTERED_SUBQUERY})
           AND e.dst IN (SELECT id FROM nodes WHERE exists_ = 1)
      )`;
  const frontierCount = (
    db().prepare(`SELECT COUNT(*) AS c FROM nodes n ${frontierWhere}`).get() as { c: number }
  ).c;

  if (frontierCount > 0) {
    const row = db()
      .prepare(
        `SELECT n.*, COALESCE(m.p, 0) AS mastery_p,
                CASE WHEN LENGTH(COALESCE(n.content,'')) > 100 THEN 1 ELSE 0 END AS has_content
           FROM nodes n
           LEFT JOIN mastery m ON m.node_id = n.id
           ${frontierWhere}
          ORDER BY n.id
          LIMIT 1 OFFSET ?`
      )
      .get(dayIdx % frontierCount) as BrowseNode & { has_content: number };
    return { ...row, reason: "frontier" };
  }

  // Fallback: any concept with content, not yet mastered
  const fallbackWhere = `
    WHERE n.exists_ = 1 AND LENGTH(COALESCE(n.content,'')) > 100
      AND n.id NOT IN (${MASTERED_SUBQUERY})`;
  const fallbackCount = (
    db().prepare(`SELECT COUNT(*) AS c FROM nodes n ${fallbackWhere}`).get() as { c: number }
  ).c;

  if (fallbackCount > 0) {
    const row = db()
      .prepare(
        `SELECT n.*, COALESCE(m.p, 0) AS mastery_p,
                CASE WHEN LENGTH(COALESCE(n.content,'')) > 100 THEN 1 ELSE 0 END AS has_content
           FROM nodes n
           LEFT JOIN mastery m ON m.node_id = n.id
           ${fallbackWhere}
          ORDER BY n.id
          LIMIT 1 OFFSET ?`
      )
      .get(dayIdx % fallbackCount) as BrowseNode & { has_content: number };
    return { ...row, reason: "unmastered" };
  }

  return null;
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
      `SELECT DATE(MIN(recorded_at), 'localtime') AS day, COUNT(*) AS count
         FROM (
           SELECT node_id, MIN(recorded_at) AS recorded_at
             FROM mastery_history
            WHERE p >= ${MASTERY_THRESHOLD}
            GROUP BY node_id
         )
        GROUP BY DATE(recorded_at, 'localtime')
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
         COUNT(CASE WHEN COALESCE(m.p, 0) >= ${MASTERY_THRESHOLD} THEN 1 END) AS mastered,
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

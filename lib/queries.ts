import { db, type NodeRow, type EdgeRow } from "./db";

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
  return !!db().prepare("SELECT 1 FROM user_knows WHERE node_id = ?").get(id);
}

export function setKnown(id: string, known: boolean) {
  if (known) db().prepare("INSERT OR IGNORE INTO user_knows(node_id) VALUES (?)").run(id);
  else db().prepare("DELETE FROM user_knows WHERE node_id = ?").run(id);
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
    (db().prepare("SELECT node_id FROM user_knows").all() as { node_id: string }[]).map((r) => r.node_id)
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
          AND n.id NOT IN (SELECT node_id FROM user_knows)
          AND NOT EXISTS (
            SELECT 1 FROM edges e
             WHERE e.src = n.id AND e.type = 'depends_on'
               AND e.dst <> n.id
               AND e.dst NOT IN (SELECT node_id FROM user_knows)
               AND e.dst IN (SELECT id FROM nodes WHERE exists_ = 1)
          )
        ORDER BY unlocks DESC, n.title ASC
        LIMIT ?`
    )
    .all(limit) as (NodeRow & { unlocks: number })[];
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
    (db().prepare("SELECT node_id FROM user_knows").all() as { node_id: string }[]).map((r) => r.node_id)
  );
  return {
    nodes: nodes.map((n) => ({ ...n, known: knownSet.has(n.id) ? 1 : 0 })),
    edges,
    center: id,
  };
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

export function stats() {
  const d = db();
  const c = (sql: string) => (d.prepare(sql).get() as { c: number }).c;
  return {
    real: c("SELECT COUNT(*) c FROM nodes WHERE exists_=1"),
    ghost: c("SELECT COUNT(*) c FROM nodes WHERE exists_=0"),
    edges: c("SELECT COUNT(*) c FROM edges"),
    dependsOn: c("SELECT COUNT(*) c FROM edges WHERE type='depends_on'"),
    known: c("SELECT COUNT(*) c FROM user_knows"),
    areas: d.prepare("SELECT area, COUNT(*) c FROM nodes WHERE exists_=1 AND area IS NOT NULL GROUP BY area ORDER BY c DESC").all() as { area: string; c: number }[],
  };
}

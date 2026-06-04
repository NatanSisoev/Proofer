import { db, MASTERY_THRESHOLD, type NodeRow } from "./db";

// Bayesian Knowledge Tracing parameters (classic four).
const P_INIT = 0.15; // prior mastery of an unseen concept
const P_TRANSIT = 0.12; // P(learn) per practice opportunity
const P_SLIP = 0.1; // P(answer wrong | mastered)
const P_GUESS = 0.2; // P(answer right | not mastered)

export function getMasteryP(id: string): number {
  const row = db().prepare("SELECT p FROM mastery WHERE node_id = ?").get(id) as { p: number } | undefined;
  return row ? row.p : P_INIT;
}

export function isMastered(id: string): boolean {
  return getMasteryP(id) >= MASTERY_THRESHOLD;
}

function writeP(id: string, p: number, touch: boolean) {
  const clamped = Math.max(0.01, Math.min(0.999, p));
  const now = touch ? new Date().toISOString() : null;
  db()
    .prepare(
      `INSERT INTO mastery(node_id, p, attempts, last_seen)
         VALUES(?, ?, ?, ?)
       ON CONFLICT(node_id) DO UPDATE SET
         p = excluded.p,
         attempts = mastery.attempts + ?,
         last_seen = COALESCE(excluded.last_seen, mastery.last_seen)`
    )
    .run(id, clamped, touch ? 1 : 0, now, touch ? 1 : 0);
}

/**
 * Update mastery from a graded attempt. `evidence` (0..1) is the grader's
 * calibrated probability the answer demonstrates mastery; we treat it as soft
 * correctness and apply a continuous BKT update, then propagate:
 *   - strong performance gently raises confidence in the concept's prerequisites
 *     (you just used them successfully),
 *   - a blamed prerequisite gets nudged down (the diagnosis made visible).
 */
export function applyAttempt(nodeId: string, evidence: number, blamedPrereq: string | null, directPrereqs: string[]) {
  const prior = getMasteryP(nodeId);

  // Posterior given a correct vs incorrect observation.
  const postCorrect = (prior * (1 - P_SLIP)) / (prior * (1 - P_SLIP) + (1 - prior) * P_GUESS);
  const postIncorrect = (prior * P_SLIP) / (prior * P_SLIP + (1 - prior) * (1 - P_GUESS));
  const posterior = evidence * postCorrect + (1 - evidence) * postIncorrect;

  // Learning transition: practice itself teaches.
  const updated = posterior + (1 - posterior) * P_TRANSIT;
  writeP(nodeId, updated, true);

  // Propagation (small, capped) — demonstrated use is weak evidence for prereqs.
  if (evidence > 0.6) {
    for (const pre of directPrereqs) {
      if (pre === blamedPrereq) continue;
      const cur = getMasteryP(pre);
      writeP(pre, cur + (1 - cur) * 0.05 * evidence, false);
    }
  }
  if (blamedPrereq) {
    const cur = getMasteryP(blamedPrereq);
    writeP(blamedPrereq, cur * 0.8, false); // diagnosis: knock the blamed prereq down
  }
}

export function setKnown(id: string, known: boolean) {
  if (known) writeP(id, 1.0, true);
  else db().prepare("DELETE FROM mastery WHERE node_id = ?").run(id);
}

/**
 * Pick the next concept to practice: prefer a frontier concept (all prereqs
 * known) with the LOWEST current mastery and the highest unlock potential — the
 * highest-leverage thing you're actually ready to learn.
 */
export function nextToPractice(): NodeRow | undefined {
  return db()
    .prepare(
      `SELECT n.* FROM nodes n
         LEFT JOIN mastery m ON m.node_id = n.id
        WHERE n.exists_ = 1
          AND COALESCE(m.p, ${P_INIT}) < ${MASTERY_THRESHOLD}
          AND NOT EXISTS (
            SELECT 1 FROM edges e
             WHERE e.src = n.id AND e.type='depends_on' AND e.dst <> n.id
               AND e.dst IN (SELECT id FROM nodes WHERE exists_=1)
               AND e.dst NOT IN (${'SELECT node_id FROM mastery WHERE p >= ' + MASTERY_THRESHOLD})
          )
        ORDER BY COALESCE(m.p, ${P_INIT}) ASC,
                 (SELECT COUNT(*) FROM edges e2 WHERE e2.dst=n.id AND e2.type='depends_on') DESC
        LIMIT 1`
    )
    .get() as NodeRow | undefined;
}

export function recordAttempt(row: {
  node_id: string;
  kind: string;
  problem: string;
  answer: string;
  verdict: string;
  evidence: number;
  gap: string;
  blamed_prereq: string;
  mode: string;
}) {
  db()
    .prepare(
      `INSERT INTO attempts(node_id,kind,problem,answer,verdict,evidence,gap,blamed_prereq,created_at,mode)
       VALUES(?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      row.node_id,
      row.kind,
      row.problem,
      row.answer,
      row.verdict,
      row.evidence,
      row.gap,
      row.blamed_prereq,
      new Date().toISOString(),
      row.mode
    );
}

export function recentAttempts(nodeId: string, limit = 5) {
  return db()
    .prepare("SELECT * FROM attempts WHERE node_id = ? ORDER BY id DESC LIMIT ?")
    .all(nodeId, limit) as any[];
}

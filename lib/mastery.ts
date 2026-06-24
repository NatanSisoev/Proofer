import { db, MASTERY_THRESHOLD, MASTERED_SUBQUERY, type NodeRow } from "./db";
import { getSelectionPolicy } from "./settings";

// Bayesian Knowledge Tracing parameters (classic four).
export const P_INIT = 0.15; // prior mastery of an unseen concept
const P_TRANSIT = 0.12;     // P(learn) per practice opportunity
const P_SLIP = 0.1;         // P(answer wrong | mastered)
const P_GUESS = 0.2;        // P(answer right | not mastered)

// Spaced repetition: half-life starts at 7 days, doubles on a correct review,
// halves on an incorrect one. A concept is "due" when days_elapsed > half_life.
const HL_INIT = 7.0;
const HL_CORRECT_FACTOR = 2.0;
const HL_PARTIAL_FACTOR = 1.2;
const HL_INCORRECT_FACTOR = 0.5;

export function getMasteryP(id: string): number {
  const row = db().prepare("SELECT p FROM mastery WHERE node_id = ?").get(id) as { p: number } | undefined;
  // Return 0 for never-practiced concepts so the display is honest.
  // The BKT computation in applyAttempt uses max(p, P_INIT) to keep the
  // math well-behaved on the first attempt.
  return row ? row.p : 0;
}

export function isMastered(id: string): boolean {
  return getMasteryP(id) >= MASTERY_THRESHOLD;
}

function writeP(id: string, p: number, touch: boolean, halfLifeMultiplier?: number) {
  const clamped = Math.max(0.01, Math.min(0.999, p));
  const now = touch ? new Date().toISOString() : null;

  if (halfLifeMultiplier !== undefined) {
    db()
      .prepare(
        `INSERT INTO mastery(node_id, p, attempts, last_seen, half_life)
           VALUES(?, ?, ?, ?, ?)
         ON CONFLICT(node_id) DO UPDATE SET
           p = excluded.p,
           attempts = mastery.attempts + ?,
           last_seen = COALESCE(excluded.last_seen, mastery.last_seen),
           half_life = MAX(1.0, MIN(365.0, mastery.half_life * ?))`
      )
      .run(id, clamped, touch ? 1 : 0, now, HL_INIT, touch ? 1 : 0, halfLifeMultiplier);
  } else {
    db()
      .prepare(
        `INSERT INTO mastery(node_id, p, attempts, last_seen, half_life)
           VALUES(?, ?, ?, ?, ?)
         ON CONFLICT(node_id) DO UPDATE SET
           p = excluded.p,
           attempts = mastery.attempts + ?,
           last_seen = COALESCE(excluded.last_seen, mastery.last_seen)`
      )
      .run(id, clamped, touch ? 1 : 0, now, HL_INIT, touch ? 1 : 0);
  }

  // Log to mastery_history for sparklines and trend analysis.
  if (touch) {
    db()
      .prepare(`INSERT INTO mastery_history(node_id, p, recorded_at) VALUES(?, ?, ?)`)
      .run(id, clamped, now);
  }
}

/**
 * Update mastery from a graded attempt. `evidence` (0..1) is the grader's
 * calibrated probability the answer demonstrates mastery; we treat it as soft
 * correctness and apply a continuous BKT update, then propagate:
 *   - strong performance gently raises confidence in the concept's prerequisites,
 *   - a blamed prerequisite gets nudged down (the diagnosis made visible).
 * The spaced-repetition half_life is also updated based on verdict.
 */
export function applyAttempt(
  nodeId: string,
  evidence: number,
  blamedPrereq: string | null,
  directPrereqs: string[]
) {
  // Use P_INIT as the minimum prior so the BKT formula is well-behaved on the
  // first attempt (getMasteryP returns 0 for never-practiced nodes).
  const prior = Math.max(getMasteryP(nodeId), P_INIT);

  // Posterior given a correct vs incorrect observation.
  const postCorrect = (prior * (1 - P_SLIP)) / (prior * (1 - P_SLIP) + (1 - prior) * P_GUESS);
  const postIncorrect = (prior * P_SLIP) / (prior * P_SLIP + (1 - prior) * (1 - P_GUESS));
  const posterior = evidence * postCorrect + (1 - evidence) * postIncorrect;

  // Learning transition: practice itself teaches.
  const updated = posterior + (1 - posterior) * P_TRANSIT;

  // Spaced repetition: update half_life based on performance.
  const hlFactor =
    evidence >= 0.75 ? HL_CORRECT_FACTOR :
    evidence >= 0.4  ? HL_PARTIAL_FACTOR :
                       HL_INCORRECT_FACTOR;

  writeP(nodeId, updated, true, hlFactor);

  // Propagation — demonstrated use is weak evidence for prereqs.
  if (evidence > 0.6) {
    for (const pre of directPrereqs) {
      if (pre === blamedPrereq) continue;
      const cur = getMasteryP(pre);
      writeP(pre, cur + (1 - cur) * 0.05 * evidence, false);
    }
  }
  if (blamedPrereq) {
    const cur = getMasteryP(blamedPrereq);
    writeP(blamedPrereq, cur * 0.8, false);
  }
}

export function setKnown(id: string, known: boolean) {
  if (known) writeP(id, 1.0, true, HL_CORRECT_FACTOR);
  else db().prepare("DELETE FROM mastery WHERE node_id = ?").run(id);
}

/**
 * Pick the next concept to practice: prefer a frontier concept (all prereqs
 * known) with the LOWEST current mastery and the highest unlock potential.
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
               AND e.dst NOT IN (${MASTERED_SUBQUERY})
          )
        ORDER BY COALESCE(m.p, ${P_INIT}) ASC,
                 (SELECT COUNT(*) FROM edges e2 WHERE e2.dst=n.id AND e2.type='depends_on') DESC
        LIMIT 1`
    )
    .get() as NodeRow | undefined;
}

// ===========================================================================
// Information-theoretic selection
// ===========================================================================

// Shannon entropy of a Bernoulli(p) — our uncertainty about whether the student
// has truly mastered a concept. Maximal at p=0.5, zero at p∈{0,1}. This is the
// information an attempt is expected to reveal about the latent mastery state.
export function masteryEntropy(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}

export type Candidate = {
  id: string; title: string; type: string | null; area: string | null;
  p: number; attempts: number; unlocks: number;
};

// Score a candidate by expected information gain. Greedy selection chases the
// LOWEST mastery — but we're already confident the student doesn't know those,
// so testing them reveals little and mostly demoralizes. Instead prefer concepts
// whose outcome is genuinely uncertain (high entropy), weighted by how much
// mastering them unlocks downstream. Never-practiced concepts are treated as
// maximally uncertain (pEff=0.5) so the frontier still advances rather than
// stalling at entropy(0)=0.
export function infoGainScore(c: { p: number; attempts: number; unlocks: number }): number {
  const pEff = c.attempts === 0 ? 0.5 : c.p;
  const unlockWeight = Math.log2(2 + c.unlocks); // 1.0 at zero deps, grows slowly
  return masteryEntropy(pEff) * unlockWeight;
}

// Learnable-now, not-yet-mastered concepts (every existing prerequisite already
// mastered — the frontier), with mastery p, attempt count, and unlock weight.
function learnableCandidates(): Candidate[] {
  return db()
    .prepare(
      `SELECT n.id, n.title, n.type, n.area,
              COALESCE(m.p, 0) AS p,
              COALESCE(m.attempts, 0) AS attempts,
              (SELECT COUNT(*) FROM edges e2 WHERE e2.dst = n.id AND e2.type='depends_on') AS unlocks
         FROM nodes n
         LEFT JOIN mastery m ON m.node_id = n.id
        WHERE n.exists_ = 1
          AND n.id NOT IN (${MASTERED_SUBQUERY})
          AND NOT EXISTS (
            SELECT 1 FROM edges e
             WHERE e.src = n.id AND e.type = 'depends_on'
               AND e.dst <> n.id
               AND e.dst NOT IN (${MASTERED_SUBQUERY})
               AND e.dst IN (SELECT id FROM nodes WHERE exists_ = 1)
          )`
    )
    .all() as Candidate[];
}

// How much a concept the student is overconfident about (predicted > actual)
// is boosted in selection. Practicing where belief outruns reality is the
// tutor's whole job — so it gets a deliberate, tunable bump on top of the
// pure mastery-model information gain. Kept self-contained (no queries.ts
// import) to avoid a cycle, since queries.ts already imports this module.
const OVERCONF_WEIGHT = 1.2;
const ACTUAL_SQL = "CASE a.verdict WHEN 'correct' THEN 1.0 WHEN 'partial' THEN 0.5 ELSE 0.0 END";

function overconfidenceMap(): Map<string, number> {
  const expr = `AVG(a.predicted_correct - (${ACTUAL_SQL}))`;
  const rows = db()
    .prepare(
      `SELECT a.node_id AS id, ${expr} AS overconf
         FROM attempts a
        WHERE a.predicted_correct IS NOT NULL
        GROUP BY a.node_id
       HAVING COUNT(*) >= 2 AND ${expr} > 0.15`
    )
    .all() as { id: string; overconf: number }[];
  return new Map(rows.map((r) => [r.id, r.overconf]));
}

/** Learnable concepts ranked by expected information gain (with an overconfidence
 *  boost), highest first. */
export function infoGainRanked(limit = 20): (Candidate & { overconf: number; score: number })[] {
  const overconf = overconfidenceMap();
  return learnableCandidates()
    .map((c) => {
      const oc = overconf.get(c.id) ?? 0;
      return { ...c, overconf: oc, score: infoGainScore(c) + OVERCONF_WEIGHT * oc };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Single highest-information-gain concept to practice next. */
export function nextByInfoGain(): NodeRow | undefined {
  const top = infoGainRanked(1)[0];
  if (!top) return undefined;
  return getNodeRow(top.id);
}

function getNodeRow(id: string): NodeRow | undefined {
  return db().prepare("SELECT * FROM nodes WHERE id = ?").get(id) as NodeRow | undefined;
}

/** Pick the next concept under the active selection policy (Settings-driven),
 *  falling back to greedy if info-gain yields no candidate. */
export function selectNext(): NodeRow | undefined {
  if (getSelectionPolicy() === "infogain") {
    return nextByInfoGain() ?? nextToPractice();
  }
  return nextToPractice();
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
  predicted_correct?: number | null;
}) {
  db()
    .prepare(
      `INSERT INTO attempts(node_id,kind,problem,answer,verdict,evidence,gap,blamed_prereq,created_at,mode,predicted_correct)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      row.node_id, row.kind, row.problem, row.answer,
      row.verdict, row.evidence, row.gap, row.blamed_prereq,
      new Date().toISOString(), row.mode,
      row.predicted_correct ?? null
    );
}

export function recentAttempts(nodeId: string, limit = 5) {
  return db()
    .prepare("SELECT * FROM attempts WHERE node_id = ? ORDER BY id DESC LIMIT ?")
    .all(nodeId, limit) as any[];
}

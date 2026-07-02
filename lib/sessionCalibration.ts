// Pure calibration math for a single practice session — how well the
// student's pre-answer confidence matched their actual verdicts. Mirrors the
// all-time formula in lib/queries.ts's calibration() (Brier score + signed
// bias), scoped to one session so the "you said 80%, you scored 50%" moment
// closes on the summary screen immediately, not later on /progress.

export type CalibratedAttempt = {
  verdict: "correct" | "partial" | "incorrect";
  predicted: number; // pre-answer confidence, 0..1
};

export function actualOutcome(verdict: CalibratedAttempt["verdict"]): number {
  return verdict === "correct" ? 1 : verdict === "partial" ? 0.5 : 0;
}

export type SessionCalibration = {
  score: number;        // 0..100, higher = better calibrated (100 - Brier%)
  bias: number;         // mean(predicted - actual); >0 overconfident, <0 underconfident
  overconfCount: number; // attempts where predicted exceeded actual by >15pp
  avgGapPp: number;      // average overconfidence gap among those, in percentage points
};

export function computeSessionCalibration(attempts: CalibratedAttempt[]): SessionCalibration | null {
  if (attempts.length === 0) return null;
  const diffs = attempts.map((a) => a.predicted - actualOutcome(a.verdict));
  const brier = diffs.reduce((s, d) => s + d * d, 0) / diffs.length;
  const bias = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  const overconfDiffs = diffs.filter((d) => d > 0.15);
  return {
    score: Math.round((1 - brier) * 100),
    bias,
    overconfCount: overconfDiffs.length,
    avgGapPp: overconfDiffs.length > 0
      ? Math.round((overconfDiffs.reduce((s, d) => s + d, 0) / overconfDiffs.length) * 100)
      : 0,
  };
}

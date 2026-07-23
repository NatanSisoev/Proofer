import { db, localDateStr } from "./db";

// Calendar arithmetic, NOT `Date.now() - i * 86_400_000`. Subtracting a fixed
// 24h across a DST transition lands on the same local date twice (or skips
// one), which would silently duplicate or drop a day in the streak walk.
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export type StreakFreezeState = {
  earned: number;        // total freeze tokens ever earned
  usedDates: string[];   // dates (local YYYY-MM-DD) a freeze bridged a missed day
  lastMilestone: number; // highest streak length (in weeks) already credited a freeze
};

function getState(): StreakFreezeState {
  try {
    const row = db().prepare("SELECT value FROM settings WHERE key = 'streak_freeze'").get() as { value: string } | undefined;
    if (!row) return { earned: 0, usedDates: [], lastMilestone: 0 };
    const parsed = JSON.parse(row.value);
    return {
      earned: parsed.earned ?? 0,
      usedDates: Array.isArray(parsed.usedDates) ? parsed.usedDates : [],
      lastMilestone: parsed.lastMilestone ?? 0,
    };
  } catch {
    return { earned: 0, usedDates: [], lastMilestone: 0 };
  }
}

function saveState(s: StreakFreezeState) {
  try {
    db().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('streak_freeze', ?)").run(JSON.stringify(s));
  } catch {
    // streak insurance is a habit-design nicety, not critical state
  }
}

export type StreakResult = {
  streakDays: number;
  freezesAvailable: number;
  freezesUsedJustNow: string[]; // dates newly bridged THIS call — surface once as "a freeze saved your streak"
};

export type ResolvedStreak = StreakFreezeState & {
  streakDays: number;
  newlyUsed: string[];
  freezesAvailable: number;
};

/**
 * The pure core of streak insurance — no DB, and `today` is injected so the
 * day-boundary behaviour is testable.
 *
 * Counts consecutive local practice days ending today (or yesterday, so an
 * in-progress streak isn't zeroed before midnight), bridging gaps with banked
 * freeze tokens, and awarding one freeze per 7 days of streak.
 *
 * A freeze is only ever spent on a gap that real practice continues *past*.
 * Without that rule a student who stopped practicing would have their banked
 * tokens silently drained — `todayStats()` runs on every home page load, so
 * merely opening the app while away used to burn insurance to manufacture a
 * streak that was never earned.
 */
export function resolveStreak(
  practiceDays: Set<string>,
  state: StreakFreezeState,
  today: Date
): ResolvedStreak {
  const usedSet = new Set(state.usedDates);
  const startOffset = practiceDays.has(localDateStr(today)) ? 0 : 1;
  let freezesLeft = state.earned - state.usedDates.length;

  // Walk back a calendar day at a time, recording a *tentative* chain.
  type Day = { date: string; real: boolean; bridgedNow: boolean };
  const chain: Day[] = [];
  for (let i = startOffset; ; i++) {
    const date = localDateStr(addDays(today, -i));
    if (practiceDays.has(date)) { chain.push({ date, real: true, bridgedNow: false }); continue; }
    if (usedSet.has(date)) { chain.push({ date, real: false, bridgedNow: false }); continue; }
    if (freezesLeft > 0) { freezesLeft--; chain.push({ date, real: false, bridgedNow: true }); continue; }
    break;
  }

  // Trim trailing bridged days: a freeze that isn't followed by real practice
  // is padding, so it neither counts toward the streak nor gets spent.
  let end = chain.length;
  while (end > 0 && !chain[end - 1].real) end--;
  const kept = chain.slice(0, end);

  const newlyUsed = kept.filter((d) => d.bridgedNow).map((d) => d.date);
  const streakDays = kept.length;

  let { earned, lastMilestone } = state;
  const milestone = Math.floor(streakDays / 7);
  if (milestone > lastMilestone) {
    earned += milestone - lastMilestone;
    lastMilestone = milestone;
  }

  return {
    streakDays,
    newlyUsed,
    earned,
    lastMilestone,
    usedDates: [...state.usedDates, ...newlyUsed],
    freezesAvailable: earned - state.usedDates.length - newlyUsed.length,
  };
}

/**
 * Lazy and idempotent — like lib/db.ts's maybeBackup, this recomputes on every
 * call but only writes when a freeze is actually newly consumed or earned.
 */
export function computeStreak(practiceDays: Set<string>): StreakResult {
  const state = getState();
  const r = resolveStreak(practiceDays, state, new Date());

  if (r.newlyUsed.length > 0 || r.earned !== state.earned) {
    saveState({ earned: r.earned, usedDates: r.usedDates, lastMilestone: r.lastMilestone });
  }

  return {
    streakDays: r.streakDays,
    freezesAvailable: r.freezesAvailable,
    freezesUsedJustNow: r.newlyUsed,
  };
}

import { db } from "./db";

// Matches lib/queries.ts's localDateStr — the student is in Europe/Madrid,
// not UTC, so every day-boundary check must use local time, not
// Date#toISOString().slice(0,10).
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type StreakFreezeState = {
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

/**
 * Cycle 2 #7 "streak insurance": computes the practice streak the same way
 * as before (consecutive local days with an attempt, ending today or
 * yesterday), but transparently bridges gaps with a banked "freeze" token
 * when one is available, and awards one new freeze per 7 days of (bridged)
 * streak. Lazy and idempotent — like lib/db.ts's maybeBackup, this recomputes
 * on every call but only writes when a freeze is actually newly consumed or
 * a new one is newly earned.
 */
export function computeStreak(practiceDays: Set<string>): StreakResult {
  const state = getState();
  const usedSet = new Set(state.usedDates);
  const todayStr = localDateStr(new Date());
  // If today has no practice yet, start the consecutive-day check from
  // yesterday so an in-progress streak isn't falsely zeroed before midnight.
  const startOffset = practiceDays.has(todayStr) ? 0 : 1;

  let streak = 0;
  let freezesLeft = state.earned - state.usedDates.length;
  const newlyUsed: string[] = [];

  for (let i = startOffset; ; i++) {
    const dateStr = localDateStr(new Date(Date.now() - i * 86_400_000));
    if (practiceDays.has(dateStr) || usedSet.has(dateStr)) {
      streak++;
      continue;
    }
    if (freezesLeft > 0) {
      freezesLeft--;
      newlyUsed.push(dateStr);
      streak++;
      continue;
    }
    break;
  }

  let { earned, lastMilestone } = state;
  const milestone = Math.floor(streak / 7);
  if (milestone > lastMilestone) {
    earned += milestone - lastMilestone;
    lastMilestone = milestone;
  }

  if (newlyUsed.length > 0 || earned !== state.earned) {
    saveState({ earned, usedDates: [...state.usedDates, ...newlyUsed], lastMilestone });
  }

  return {
    streakDays: streak,
    freezesAvailable: earned - state.usedDates.length - newlyUsed.length,
    freezesUsedJustNow: newlyUsed,
  };
}

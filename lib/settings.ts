import { db } from "./db";

const DEFAULTS: Record<string, string> = {
  daily_goal: "5",
  voice_lang: "en-US",
  calibration_enabled: "1",
  selection_policy: "infogain",
};

function getSetting(key: string): string {
  try {
    const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value ?? DEFAULTS[key] ?? "";
  } catch {
    return DEFAULTS[key] ?? "";
  }
}

export function getDailyGoal(): number {
  return Math.max(1, parseInt(getSetting("daily_goal"), 10) || 5);
}

export function getVoiceLang(): string {
  return getSetting("voice_lang") || "en-US";
}

// Whether to ask the student to rate their confidence before each answer
// (the calibration / Brier-score signal). On by default; togglable in Settings.
export function getCalibrationEnabled(): boolean {
  return getSetting("calibration_enabled") !== "0";
}

export function getLearningGoal(): string {
  return getSetting("learning_goal");
}

export function setLearningGoal(nodeId: string): void {
  try {
    if (nodeId) {
      db().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('learning_goal', ?)").run(nodeId);
    } else {
      db().prepare("DELETE FROM settings WHERE key = 'learning_goal'").run();
    }
  } catch {
    // ignore
  }
}

export type SelectionPolicy = "infogain" | "greedy";

// How the tutor picks what to practice next. "infogain" prefers concepts whose
// outcome is most uncertain (highest expected information about mastery),
// weighted by downstream unlocks; "greedy" is the classic lowest-mastery-first.
// Defaults to infogain — the better policy — with greedy as an escape hatch.
export function getSelectionPolicy(): SelectionPolicy {
  return getSetting("selection_policy") === "greedy" ? "greedy" : "infogain";
}

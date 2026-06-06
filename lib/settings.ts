import { db } from "./db";

const DEFAULTS: Record<string, string> = {
  daily_goal: "5",
  voice_lang: "en-US",
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

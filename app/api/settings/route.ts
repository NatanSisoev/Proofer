import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEFAULTS: Record<string, string> = {
  daily_goal: "5",
  voice_lang: "en-US",
  gemini_api_key: "",
  anthropic_api_key: "",
};

function getAll(): Record<string, string> {
  const rows = db().prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  return { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
}

export async function GET() {
  return NextResponse.json(getAll());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const stmt = db().prepare("INSERT INTO settings(key, value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== "string" && typeof value !== "number") continue;
    stmt.run(key, String(value));
  }
  return NextResponse.json(getAll());
}

import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { join } from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  const scriptPath = join(process.cwd(), "scripts", "import-vault.mjs");
  try {
    const out = execSync(`node --experimental-sqlite "${scriptPath}"`, {
      cwd: process.cwd(),
      timeout: 90_000,
      encoding: "utf8",
    });
    // Reset the DB singleton so the next request picks up the refreshed data
    if (global.__prooferDb) {
      try { (global.__prooferDb as any).close(); } catch {}
      global.__prooferDb = undefined;
    }
    const summary = out.split("\n").filter(Boolean).slice(-6).join("\n");
    return NextResponse.json({ ok: true, summary });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Sync failed", detail: e.stderr || "" },
      { status: 500 }
    );
  }
}

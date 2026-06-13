import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { join } from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const execFileAsync = promisify(execFile);

export async function POST() {
  const scriptPath = join(process.cwd(), "scripts", "import-vault.mjs");
  try {
    // execFile (async) instead of execSync so the event loop — and every
    // other request — isn't blocked for up to 90s while the import runs.
    const { stdout } = await execFileAsync("node", ["--experimental-sqlite", scriptPath], {
      cwd: process.cwd(),
      timeout: 90_000,
      encoding: "utf8",
    });
    // Reset the DB singleton so the next request picks up the refreshed data.
    // Don't close the old handle: now that sync runs async, a concurrent
    // request may still hold a reference to it — closing here would make
    // that request crash on a closed handle. WAL mode allows the stale
    // connection to coexist harmlessly until it's garbage-collected.
    global.__prooferDb = undefined;
    const summary = stdout.split("\n").filter(Boolean).slice(-6).join("\n");
    return NextResponse.json({ ok: true, summary });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Sync failed", detail: e.stderr || "" },
      { status: 500 }
    );
  }
}

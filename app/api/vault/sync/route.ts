import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { clearLLMCache, hasEmbeddings } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const execFileAsync = promisify(execFile);

// Module-scoped lock. Now that sync runs async (non-blocking), two POSTs
// (rapid double-click, a second browser tab, a stray retry) could otherwise
// each spawn import-vault.mjs against the SAME graph.db at once — two writers
// rebuilding one SQLite file is a recipe for corruption. Reject the second
// while the first is in flight. Held on globalThis so it survives the HMR
// module re-evaluation that would otherwise reset a plain module variable.
const lockHost = globalThis as typeof globalThis & { __prooferSyncing?: boolean };

export async function POST() {
  if (lockHost.__prooferSyncing) {
    return NextResponse.json(
      { error: "A vault sync is already in progress — wait for it to finish." },
      { status: 409 }
    );
  }
  lockHost.__prooferSyncing = true;

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
    // Clear the LLM cache so any explain/compare responses that
    // referenced old note content are regenerated on the next request.
    clearLLMCache();

    // Best-effort embedding backfill (Cycle 2 #3) — fire-and-forget so the
    // sync response isn't held hostage by a slow embedding batch.
    // scripts/embed.mjs is idempotent (hash-cached), so a partial or failed
    // run just gets caught up on the next sync.
    if (hasEmbeddings()) {
      const embedScript = join(process.cwd(), "scripts", "embed.mjs");
      execFileAsync("node", ["--experimental-sqlite", embedScript], {
        cwd: process.cwd(),
        timeout: 90_000,
      }).catch((e: any) => console.error("[embed] background backfill failed:", e?.message || e));
    }

    const summary = stdout.split("\n").filter(Boolean).slice(-6).join("\n");
    return NextResponse.json({ ok: true, summary });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Sync failed", detail: e.stderr || "" },
      { status: 500 }
    );
  } finally {
    lockHost.__prooferSyncing = false;
  }
}

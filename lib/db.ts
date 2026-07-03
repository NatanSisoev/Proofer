import { DatabaseSync, StatementSync } from "node:sqlite";
import { readFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

// Singleton DB connection, reused across requests in the Next server process.
declare global {
  // eslint-disable-next-line no-var
  var __prooferDb: DatabaseSync | undefined;
  // eslint-disable-next-line no-var
  var __prooferPatched: boolean | undefined;
  // eslint-disable-next-line no-var
  var __prooferBackupDay: string | undefined;
}

const DB_PATH = join(process.cwd(), "data", "graph.db");
export const BACKUP_DIR = join(process.cwd(), "data", "backups");
const BACKUPS_TO_KEEP = 14;

// The student is in Europe/Madrid, not UTC — matches lib/queries.ts's
// localDateStr so "today's backup" lines up with the same day boundary used
// everywhere else (streaks, due-dates), not a UTC one that could roll over
// mid-evening.
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pruneOldBackups() {
  const files = readdirSync(BACKUP_DIR)
    .filter((f) => /^graph-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort();
  const excess = files.length - BACKUPS_TO_KEEP;
  for (let i = 0; i < excess; i++) unlinkSync(join(BACKUP_DIR, files[i]));
}

// VACUUM INTO produces a consistent single-file snapshot even while the
// source DB is in WAL mode — safe to call on a live connection. Guarded by
// __prooferBackupDay so the (cheap) string-compare runs on every db() call
// but the (not-so-cheap) file I/O only happens once per local calendar day.
function maybeBackup(d: DatabaseSync) {
  const today = localDateStr(new Date());
  if (global.__prooferBackupDay === today) return;
  global.__prooferBackupDay = today;
  try {
    mkdirSync(BACKUP_DIR, { recursive: true });
    const target = join(BACKUP_DIR, `graph-${today}.db`);
    if (!existsSync(target)) {
      d.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    }
    pruneOldBackups();
  } catch (err) {
    console.error("[backup] daily snapshot failed:", err);
  }
}

// node:sqlite's StatementSync.all()/get() return rows as `[Object: null
// prototype]`, which React rejects when passed from a Server Component to a
// Client Component ("Only plain objects ... can be passed"). Patch them once
// to return plain-object copies so query results are safe to pass as props.
function patchStatementSync() {
  if (global.__prooferPatched) return;
  const proto = StatementSync.prototype as any;
  const origAll = proto.all;
  const origGet = proto.get;
  proto.all = function (...args: unknown[]) {
    return origAll.apply(this, args).map((row: object) => ({ ...row }));
  };
  proto.get = function (...args: unknown[]) {
    const row = origGet.apply(this, args);
    return row === undefined ? row : { ...row };
  };
  global.__prooferPatched = true;
}

// Run unconditionally on every module evaluation (including HMR reloads),
// not just when the DB singleton is first created — the singleton survives
// HMR via `global`, but a stale StatementSync.prototype would otherwise
// never get patched on the live process.
patchStatementSync();

// Additive column migrations for schema fields introduced after a DB was first
// created. CREATE TABLE IF NOT EXISTS won't add columns to an existing table,
// and SQLite has no ADD COLUMN IF NOT EXISTS — so we attempt each ALTER and
// ignore the "duplicate column name" error when it has already been applied.
const MIGRATIONS = [
  "ALTER TABLE attempts ADD COLUMN predicted_correct REAL",
];

function migrate(d: DatabaseSync) {
  for (const stmt of MIGRATIONS) {
    try {
      d.exec(stmt);
    } catch {
      // Column already exists (or table not yet present) — safe to ignore.
    }
  }
}

export function db(): DatabaseSync {
  if (!global.__prooferDb) {
    const d = new DatabaseSync(DB_PATH);
    d.exec("PRAGMA journal_mode = WAL;");
    // Ensure schema exists (CREATE IF NOT EXISTS) so new tables like mastery/
    // attempts appear without forcing a re-import of the vault.
    d.exec(readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8"));
    migrate(d);
    global.__prooferDb = d;
  }
  maybeBackup(global.__prooferDb);
  return global.__prooferDb;
}

// A node counts as "known" once inferred mastery crosses this threshold.
export const MASTERY_THRESHOLD = 0.8;
export const MASTERED_SUBQUERY = `SELECT node_id FROM mastery WHERE p >= ${MASTERY_THRESHOLD}`;

export type NodeRow = {
  id: string;
  title: string;
  type: string | null;
  area: string | null;
  overview: string | null;
  content: string | null;
  path: string | null;
  exists_: number;
};

export type EdgeRow = {
  src: string;
  dst: string;
  type: string;
  context: string | null;
  section: string | null;
  confidence: number;
  source: string;
};

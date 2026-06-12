import { DatabaseSync, StatementSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Singleton DB connection, reused across requests in the Next server process.
declare global {
  // eslint-disable-next-line no-var
  var __prooferDb: DatabaseSync | undefined;
  // eslint-disable-next-line no-var
  var __prooferPatched: boolean | undefined;
}

const DB_PATH = join(process.cwd(), "data", "graph.db");

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

export function db(): DatabaseSync {
  if (!global.__prooferDb) {
    const d = new DatabaseSync(DB_PATH);
    d.exec("PRAGMA journal_mode = WAL;");
    // Ensure schema exists (CREATE IF NOT EXISTS) so new tables like mastery/
    // attempts appear without forcing a re-import of the vault.
    d.exec(readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8"));
    global.__prooferDb = d;
  }
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

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Singleton DB connection, reused across requests in the Next server process.
declare global {
  // eslint-disable-next-line no-var
  var __prooferDb: DatabaseSync | undefined;
}

const DB_PATH = join(process.cwd(), "data", "graph.db");

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

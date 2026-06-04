import { DatabaseSync } from "node:sqlite";
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
    d.exec("PRAGMA foreign_keys = ON;");
    global.__prooferDb = d;
  }
  return global.__prooferDb;
}

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

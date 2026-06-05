import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const db = new DatabaseSync(join(ROOT, "data", "graph.db"));

// Run schema so any new tables are created
db.exec(readFileSync(join(ROOT, "db", "schema.sql"), "utf8"));
db.exec("PRAGMA wal_checkpoint(PASSIVE)");

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("tables:", tables.map((t) => t.name));

const problems = db.prepare("SELECT COUNT(*) as n FROM problems").get();
console.log("problems:", problems.n);

const attempts = db.prepare("SELECT COUNT(*) as n FROM attempts").get();
console.log("attempts:", attempts.n);

const mastery = db.prepare("SELECT COUNT(*) as n FROM mastery").get();
console.log("mastery rows:", mastery.n);

const history = db.prepare("SELECT COUNT(*) as n FROM mastery_history").get();
console.log("mastery_history rows:", history.n);

const recent = db.prepare("SELECT id, node_id, kind, created_at FROM problems ORDER BY id DESC LIMIT 3").all();
console.log("recent problems:", recent.map((r) => `#${r.id} ${r.node_id} (${r.kind})`));

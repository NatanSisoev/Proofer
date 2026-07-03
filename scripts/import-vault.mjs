// Proofer vault importer.
// Reads an Obsidian math vault and produces a TYPED knowledge graph in SQLite.
//
//   node --experimental-sqlite scripts/import-vault.mjs [vaultNotesDir] [--source=<name>]
//
// The wedge: 1,660 hand-written atomic notes already encode a graph implicitly
// (frontmatter type/field + [[wikilinks]]). We make that graph explicit and typed.
//
// Multi-source (Cycle 2 #4a): --source=<name> (default "main") scopes the
// rebuild to just that source's own nodes/edges, so importing a course vault
// doesn't wipe the main Mathematics vault or vice versa. A course note's
// [[Compactness]] still resolves to the main vault's existing node instead of
// spawning a duplicate ghost — see resolveTarget's externalResolve lookup.

import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync, statSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const rawArgs = process.argv.slice(2);
const flags = {};
const positional = [];
for (const a of rawArgs) {
  const m = a.match(/^--([^=]+)=(.*)$/);
  if (m) flags[m[1]] = m[2];
  else positional.push(a);
}
const VAULT_NOTES = positional[0] || "C:\\Users\\natan\\Mathematics\\Notes";
const SOURCE = flags.source || "main";
const DB_DIR = join(ROOT, "data");
const DB_PATH = join(DB_DIR, "graph.db");

// ---------------------------------------------------------------------------
// 1. Walk the vault
// ---------------------------------------------------------------------------
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name.startsWith(".") || name === "node_modules") continue;
      walk(full, out);
    } else if (extname(name) === ".md") {
      out.push(full);
    }
  }
  return out;
}

const norm = (s) => s.toLowerCase().trim().replace(/\s+/g, " ");

console.log(`Reading vault: ${VAULT_NOTES}`);
console.log(`Source: ${SOURCE}`);
if (!existsSync(VAULT_NOTES)) {
  console.error(`Vault notes dir not found: ${VAULT_NOTES}`);
  process.exit(1);
}
const files = walk(VAULT_NOTES);
console.log(`Found ${files.length} markdown files.`);

// Open the DB early (before parsing) so cross-source link resolution can
// consult nodes already imported from OTHER sources — a course note's
// [[Compactness]] should resolve to the main vault's existing node, not
// spawn a duplicate ghost. Nothing is written yet; schema is idempotent
// (CREATE TABLE IF NOT EXISTS).
if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec(readFileSync(join(ROOT, "db", "schema.sql"), "utf8"));
// CREATE TABLE IF NOT EXISTS above won't retrofit `source` onto a `nodes`
// table created before this column existed — this script has no dependency
// on lib/db.ts's MIGRATIONS array (the Next app's), so it self-heals here
// too. Safe to run unconditionally: SQLite errors on a duplicate column,
// which is exactly the case this ignores.
try { db.exec("ALTER TABLE nodes ADD COLUMN source TEXT NOT NULL DEFAULT 'main'"); } catch {}

// title (normalized) -> id, for every node NOT owned by this source — real
// or ghost. Reusing an existing other-source ghost (rather than creating a
// new one) avoids a PRIMARY KEY collision when two sources independently
// reference the same not-yet-written concept.
const externalResolve = new Map(
  db
    .prepare("SELECT id FROM nodes WHERE source != ?")
    .all(SOURCE)
    .map((r) => [norm(r.id), r.id])
);

// ---------------------------------------------------------------------------
// 2. Parse notes into node records + build resolution maps
// ---------------------------------------------------------------------------
const firstScalar = (v) => (Array.isArray(v) ? v[0] : v);

/** @type {Map<string, any>} */
const nodes = new Map(); // id -> node record (this source's own real + ghost nodes)
const resolve = new Map(); // normalized title/alias -> id, scoped to this source's own nodes

const parsed = [];
for (const path of files) {
  const raw = readFileSync(path, "utf8");
  let fm, body;
  try {
    const g = matter(raw);
    fm = g.data;
    body = g.content;
  } catch {
    fm = {};
    body = raw;
  }
  const title = basename(path, ".md");
  const id = title; // wikilinks reference notes by title => title is the canonical id
  const type = firstScalar(fm.type) || null;
  const area = firstScalar(fm.field) || null;

  // ^Overview is the one-line blockquote right under the H1.
  const overviewMatch = body.match(/^>\s?(.+?)\s*$\s*\^Overview/ms);
  const overview = overviewMatch ? overviewMatch[1].replace(/\n>\s?/g, " ").trim() : null;

  const node = { id, title, type, area, overview, content: body.trim(), path, exists_: 1, source: SOURCE };
  nodes.set(id, node);
  resolve.set(norm(title), id);
  for (const a of fm.aliases || []) if (a) resolve.set(norm(String(a)), id);

  parsed.push({ id, body });
}
console.log(`Parsed ${nodes.size} real nodes.`);

// ---------------------------------------------------------------------------
// 3. Section-aware edge extraction
// ---------------------------------------------------------------------------
// Split a note body into (sectionName, text) regions by H2 headers, so we can
// classify a [[link]] by WHERE it appears: a link in the Statement is a
// prerequisite; a link under Connections described as "equivalent" is an
// equivalence; etc.
function sections(body) {
  const out = [];
  let current = "Overview";
  let buf = [];
  const flush = () => {
    if (buf.length) out.push({ name: current, text: buf.join("\n") });
    buf = [];
  };
  for (const line of body.split(/\r?\n/)) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      flush();
      current = h[1];
    } else {
      buf.push(line);
    }
  }
  flush();
  return out;
}

const WIKILINK = /\[\[([^\]]+)\]\]/g;

// Which sections are "you must understand the target to understand this note".
const PREREQ_SECTIONS = new Set([
  "Statement",
  "Remarks",
  "Proof",
  "Intuition",
  "Motivation",
  "Overview",
]);

/**
 * Classify one link occurrence into a typed edge.
 * Returns { type, confidence } where type is from the core taxonomy.
 */
function classify(section, lineText) {
  const t = lineText.toLowerCase();
  if (section === "Connections") {
    if (/\bequivalent\b/.test(t)) return { type: "equivalent_to", confidence: 0.7, dir: "fwd" };
    if (/special case|specializ/.test(t)) return { type: "generalizes", confidence: 0.6, dir: "rev" }; // target is special case => this note generalizes target
    if (/generaliz/.test(t)) return { type: "generalizes", confidence: 0.6, dir: "fwd" }; // target generalizes this note
    return { type: "related", confidence: 0.4, dir: "fwd" };
  }
  if (section === "Examples" || section === "Counterexamples") {
    // Links inside examples usually reference supporting concepts; keep weak.
    return { type: "related", confidence: 0.3, dir: "fwd" };
  }
  if (PREREQ_SECTIONS.has(section)) {
    const conf = section === "Statement" ? 0.9 : section === "Proof" ? 0.75 : 0.6;
    return { type: "depends_on", confidence: conf, dir: "fwd" };
  }
  return { type: "related", confidence: 0.3, dir: "fwd" };
}

// Edge strength ordering for dedup (keep the most semantically specific edge).
const STRENGTH = {
  depends_on: 5,
  generalizes: 4,
  equivalent_to: 4,
  instance_of: 3,
  contradicts: 3,
  related: 1,
};

/** @type {Map<string, any>} */
const edges = new Map(); // key src|dst -> best edge

function addEdge(src, dst, type, confidence, context, section, source) {
  if (!src || !dst || src === dst) return;
  const key = `${src}\u0000${dst}`;
  const cand = { src, dst, type, confidence, context, section, source };
  const prev = edges.get(key);
  if (
    !prev ||
    STRENGTH[type] > STRENGTH[prev.type] ||
    (STRENGTH[type] === STRENGTH[prev.type] && confidence > prev.confidence)
  ) {
    edges.set(key, cand);
  }
}

let ghostCount = 0;
let crossSourceCount = 0;
function resolveTarget(rawTarget) {
  // [[Title|alias]] -> Title ; [[Title#^anchor]] / [[Title#heading]] -> Title
  let target = rawTarget.split("|")[0].split("#")[0].trim();
  if (!target) return null; // self-anchor like [[#^Foo]]
  const id = resolve.get(norm(target));
  if (id) return id;
  // Not one of this source's own notes — check whether another source
  // already has it (real note or ghost) before assuming it's a new gap.
  const external = externalResolve.get(norm(target));
  if (external) {
    crossSourceCount++;
    return external;
  }
  // Unresolved anywhere => a GAP in the graph. Record a ghost node, owned by
  // this source (it's this source's notes that revealed the gap).
  if (!nodes.has(target)) {
    nodes.set(target, {
      id: target,
      title: target,
      type: null,
      area: null,
      overview: null,
      content: null,
      path: null,
      exists_: 0,
      source: SOURCE,
    });
    resolve.set(norm(target), target);
    ghostCount++;
  }
  return target;
}

for (const { id, body } of parsed) {
  for (const sec of sections(body)) {
    for (const line of sec.text.split(/\r?\n/)) {
      let m;
      WIKILINK.lastIndex = 0;
      while ((m = WIKILINK.exec(line)) !== null) {
        const dst = resolveTarget(m[1]);
        if (!dst) continue;
        const { type, confidence, dir } = classify(sec.name, line);
        const ctx = line.replace(/^>\s?/, "").trim().slice(0, 240);
        if (dir === "rev") addEdge(dst, id, type, confidence, ctx, sec.name, "heuristic");
        else addEdge(id, dst, type, confidence, ctx, sec.name, "heuristic");
      }
    }
  }
}

console.log(
  `Built ${edges.size} edges (${ghostCount} new ghost nodes, ${crossSourceCount} links resolved to other sources).`
);

// ---------------------------------------------------------------------------
// 4. Load into SQLite
// ---------------------------------------------------------------------------
// Scoped to this source only — edges are always inserted keyed by the note
// that declared the wikilink (src), so "this source's edges" is exactly the
// set whose src belongs to this source, regardless of where dst points.
// Other sources' nodes/edges (and mastery/attempts/bookmarks/node_notes/
// settings, which aren't touched by import at all) are left untouched.
db.prepare("DELETE FROM edges WHERE src IN (SELECT id FROM nodes WHERE source = ?)").run(SOURCE);
db.prepare("DELETE FROM nodes WHERE source = ?").run(SOURCE);

const insNode = db.prepare(
  `INSERT INTO nodes (id,title,type,area,overview,content,path,exists_,source)
   VALUES (?,?,?,?,?,?,?,?,?)`
);
const insEdge = db.prepare(
  `INSERT OR IGNORE INTO edges (src,dst,type,context,section,confidence,source)
   VALUES (?,?,?,?,?,?,?)`
);

db.exec("BEGIN");
for (const n of nodes.values()) {
  insNode.run(n.id, n.title, n.type, n.area, n.overview, n.content, n.path, n.exists_, n.source);
}
for (const e of edges.values()) {
  insEdge.run(e.src, e.dst, e.type, e.context, e.section, e.confidence, e.source);
}
db.exec("COMMIT");

// ---------------------------------------------------------------------------
// 5. Report
// ---------------------------------------------------------------------------
const count = (sql) => db.prepare(sql).get().c;
const countBySource = (sql) => db.prepare(sql).get(SOURCE).c;
console.log("\n=== Import summary ===");
console.log(`source '${SOURCE}': ${countBySource("SELECT COUNT(*) c FROM nodes WHERE source=? AND exists_=1")} real, ${countBySource("SELECT COUNT(*) c FROM nodes WHERE source=? AND exists_=0")} ghost`);
console.log(`nodes (real, all sources):  ${count("SELECT COUNT(*) c FROM nodes WHERE exists_=1")}`);
console.log(`nodes (ghost, all sources): ${count("SELECT COUNT(*) c FROM nodes WHERE exists_=0")}`);
console.log(`edges total (all sources):  ${count("SELECT COUNT(*) c FROM edges")}`);
for (const row of db
  .prepare("SELECT type, COUNT(*) c FROM edges GROUP BY type ORDER BY c DESC")
  .all()) {
  console.log(`  ${row.type.padEnd(14)} ${row.c}`);
}
console.log("\nTop 10 most-depended-on concepts (prerequisite hubs):");
for (const row of db
  .prepare(
    `SELECT dst, COUNT(*) c FROM edges WHERE type='depends_on'
     GROUP BY dst ORDER BY c DESC LIMIT 10`
  )
  .all()) {
  console.log(`  ${String(row.c).padStart(4)}  ${row.dst}`);
}
db.close();
console.log(`\nWrote ${DB_PATH}`);

// Proofer embedding backfill (Cycle 2 #3).
// Embeds every real node's title+overview+content via Gemini's embeddings
// endpoint, caching by content hash so unchanged notes are skipped on re-runs.
//
//   node --experimental-sqlite scripts/embed.mjs
//
// No-ops cleanly (exit 0) when no Gemini key is configured — safe to always
// chain after an import.

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DB_PATH = join(ROOT, "data", "graph.db");
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
// The free tier's embedding quota is ~100 req/min and — critically —
// batchEmbedContents counts every sub-request against it in one shot (a
// single 100-item batch call exhausts the whole quota instantly, confirmed
// live: 429 RESOURCE_EXHAUSTED on the very first call). The singular
// embedContent endpoint doesn't have that cliff, so this script paces
// sequential calls instead of batching.
const EMBED_DELAY_MS = 700; // ~85 req/min — a safety margin under the ~100/min cap

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec(readFileSync(join(ROOT, "db", "schema.sql"), "utf8"));

// Settings-table key wins over env, matching lib/llm.ts's getLLMConfig precedence.
function getGeminiKey() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'gemini_api_key'").get();
  const fromSettings = row?.value?.trim();
  return fromSettings || (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
}

const apiKey = getGeminiKey();
if (!apiKey) {
  console.log("No Gemini API key configured (Settings or GEMINI_API_KEY/GOOGLE_API_KEY) — skipping embeddings.");
  db.close();
  process.exit(0);
}

function embedInputText(node) {
  return [node.title, node.overview, node.content].filter(Boolean).join("\n\n").slice(0, 8000);
}

function hashOf(text) {
  return createHash("sha256").update(EMBED_MODEL + "\0" + text).digest("hex");
}

// Mirrors lib/vectors.ts#encodeVector — kept duplicated since this plain
// .mjs script can't import TypeScript without a build step.
function encodeVector(values) {
  return Buffer.from(new Float32Array(values).buffer);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function embedOne(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ model: `models/${EMBED_MODEL}`, content: { parts: [{ text }] } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Gemini embeddings HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  if (!data?.embedding?.values) throw new Error("Gemini embeddings returned no data");
  return data.embedding.values;
}

async function main() {
  const nodes = db.prepare("SELECT id, title, overview, content FROM nodes WHERE exists_ = 1").all();
  const existingHashes = new Map(
    db.prepare("SELECT node_id, hash FROM embeddings").all().map((r) => [r.node_id, r.hash])
  );

  const toEmbed = [];
  for (const n of nodes) {
    const text = embedInputText(n);
    if (!text) continue;
    const hash = hashOf(text);
    if (existingHashes.get(n.id) === hash) continue; // content (and model) unchanged — skip
    toEmbed.push({ id: n.id, text, hash });
  }

  console.log(`${nodes.length} real nodes, ${toEmbed.length} need (re-)embedding.`);

  const upsert = db.prepare(
    `INSERT INTO embeddings(node_id, hash, vector, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(node_id) DO UPDATE SET hash = excluded.hash, vector = excluded.vector, updated_at = excluded.updated_at`
  );

  let done = 0;
  for (let i = 0; i < toEmbed.length; i++) {
    const item = toEmbed[i];
    let vector;
    try {
      vector = await embedOne(item.text);
    } catch (e) {
      if (e.status === 429) {
        console.log(`Rate-limited after ${done}/${toEmbed.length} — stopping this run early; the rest resume next time (hash-cached, nothing lost).`);
        break;
      }
      console.error(`Failed to embed "${item.id}": ${e.message}`);
      continue; // one bad node shouldn't sink the whole run
    }
    upsert.run(item.id, item.hash, encodeVector(vector), new Date().toISOString());
    done++;
    if (done % 20 === 0) console.log(`Embedded ${done}/${toEmbed.length}`);
    if (i < toEmbed.length - 1) await sleep(EMBED_DELAY_MS);
  }
  console.log(`Embedded ${done}/${toEmbed.length} total this run.`);

  // Prune embeddings for nodes that no longer exist (deleted/renamed notes) —
  // the importer's DELETE FROM nodes doesn't touch this table, so stale rows
  // would otherwise accumulate forever.
  const nodeIds = new Set(nodes.map((n) => n.id));
  const stale = db.prepare("SELECT node_id FROM embeddings").all().filter((r) => !nodeIds.has(r.node_id));
  if (stale.length > 0) {
    const del = db.prepare("DELETE FROM embeddings WHERE node_id = ?");
    db.exec("BEGIN");
    for (const r of stale) del.run(r.node_id);
    db.exec("COMMIT");
    console.log(`Pruned ${stale.length} stale embedding(s).`);
  }
}

try {
  await main();
} catch (e) {
  console.error("Embedding backfill failed:", e.message || e);
  process.exitCode = 1;
} finally {
  db.close();
}
console.log("Done.");

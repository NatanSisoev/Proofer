-- Proofer graph schema (SQLite dialect; standard SQL so it ports to Postgres).
-- Nodes are mathematical objects; edges are TYPED relationships.

CREATE TABLE IF NOT EXISTS nodes (
  id        TEXT PRIMARY KEY,   -- canonical slug (note title)
  title     TEXT NOT NULL,
  type      TEXT,               -- Definition | Theorem | Lemma | ... (from frontmatter)
  area      TEXT,               -- field: Topology, Analysis, ...
  overview  TEXT,               -- one-line ^Overview blurb
  content   TEXT,               -- full markdown body (for the node page)
  path      TEXT,               -- source file path
  exists_   INTEGER NOT NULL DEFAULT 1  -- 0 = "ghost": referenced but no note yet (a gap)
);

-- Typed, directed edges. Convention: src --type--> dst.
-- depends_on:    src needs dst to be understood/stated (dst is a PREREQUISITE of src)
-- generalizes:   src is a generalization of dst (dst is a special case)
-- equivalent_to: symmetric (stored once, traversed both ways)
-- instance_of:   src (example/counterexample) illustrates dst
-- proven_by:     src's proof invokes dst
-- contradicts:   src refutes / is a counterexample to dst
-- related:       untyped fallback (an edge we haven't classified yet)
CREATE TABLE IF NOT EXISTS edges (
  src        TEXT NOT NULL,
  dst        TEXT NOT NULL,
  type       TEXT NOT NULL,
  context    TEXT,              -- the surrounding text that justified this edge
  section    TEXT,              -- which note section the link came from
  confidence REAL NOT NULL DEFAULT 1.0,
  source     TEXT NOT NULL,     -- wikilink | connections | heuristic
  PRIMARY KEY (src, dst, type)
);

CREATE INDEX IF NOT EXISTS idx_edges_src  ON edges(src, type);
CREATE INDEX IF NOT EXISTS idx_edges_dst  ON edges(dst, type);
CREATE INDEX IF NOT EXISTS idx_nodes_area ON nodes(area);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);

-- Single-user "what I know" state. This is the moat ChatGPT can't have:
-- personalized readiness + frontier are computed against this set.
-- (Kept for back-compat; mastery below is now the source of truth.)
CREATE TABLE IF NOT EXISTS user_knows (
  node_id  TEXT PRIMARY KEY
);

-- MASTERY: the real signal. Not "I clicked known" — an INFERRED probability that
-- you understand each concept, updated by Bayesian Knowledge Tracing from your
-- performance on generated problems. A node counts as "known" when p >= 0.8.
CREATE TABLE IF NOT EXISTS mastery (
  node_id    TEXT PRIMARY KEY,
  p          REAL NOT NULL DEFAULT 0.15,  -- P(you have mastered this)
  attempts   INTEGER NOT NULL DEFAULT 0,
  last_seen  TEXT,                         -- ISO datetime of last practice
  half_life  REAL NOT NULL DEFAULT 7.0     -- retention half-life in days (doubles on success)
);

-- Mastery timeline: one row per update, enabling sparklines and velocity calculations.
CREATE TABLE IF NOT EXISTS mastery_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id     TEXT NOT NULL,
  p           REAL NOT NULL,
  recorded_at TEXT NOT NULL  -- ISO datetime
);

CREATE INDEX IF NOT EXISTS idx_mh_node ON mastery_history(node_id, recorded_at);

-- ATTEMPTS: every generated problem + your free-form answer + the grader's verdict
-- and the prerequisite it blamed. This log IS the long-term dataset — the record of
-- which misconception precedes which error, impossible for a stateless chatbot to own.
CREATE TABLE IF NOT EXISTS attempts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id       TEXT NOT NULL,
  kind          TEXT,            -- compute | prove | counterexample | explain
  problem       TEXT NOT NULL,
  answer        TEXT,
  verdict       TEXT,            -- correct | partial | incorrect
  evidence      REAL,            -- 0..1 mastery evidence from the grader
  gap           TEXT,            -- the specific identified misunderstanding
  blamed_prereq TEXT,            -- prerequisite the error was attributed to
  created_at    TEXT,
  mode          TEXT             -- 'ai' (real grading) | 'demo' (no API key)
);

CREATE INDEX IF NOT EXISTS idx_attempts_node ON attempts(node_id);

-- Generated problems live here so the ideal solution / rubric stay server-side
-- (the student grades against a problemId, never sees the answer key).
CREATE TABLE IF NOT EXISTS problems (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id        TEXT NOT NULL,
  kind           TEXT,
  problem        TEXT NOT NULL,
  ideal_solution TEXT,
  rubric         TEXT,   -- JSON array
  prereqs        TEXT,   -- JSON array of prerequisite node ids
  mode           TEXT,   -- ai | demo
  created_at     TEXT
);

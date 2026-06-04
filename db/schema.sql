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
CREATE TABLE IF NOT EXISTS user_knows (
  node_id  TEXT PRIMARY KEY
);

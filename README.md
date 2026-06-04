# Proofer

A **typed knowledge graph of mathematics**, bootstrapped from an existing Obsidian vault.

Mathematics is not a pile of notes — it's concepts joined by *typed* relationships
(`depends_on`, `generalizes`, `equivalent_to`, …). Proofer makes that graph explicit
and navigable, and adds the one thing a chatbot structurally cannot: **personalized
state** — what *you* know — so it can compute readiness and show your learning frontier.

## What's here (MVP vertical slice)

- **Vault importer** (`scripts/import-vault.mjs`) — walks an Obsidian math vault, turns each
  note into a typed node (from frontmatter `type`/`field`), and classifies every
  `[[wikilink]]` into a typed edge based on *which section* it appears in (a link in a
  Statement is a prerequisite; "equivalent" in Connections is an equivalence; …).
  Unresolved links become **ghost nodes** — explicit gaps in the graph.
- **Node page** — metadata, rendered statement/proof (KaTeX), an **ego-graph** of the
  local neighborhood, and typed incoming/outgoing relationships.
- **Prerequisite closure** — cycle-safe recursive `depends_on` traversal with dependency depth.
- **Readiness score** — fraction of a concept's prerequisite closure you've marked known.
- **Knowledge frontier** — concepts whose every prerequisite you already know, ranked by
  how much they unlock. Start knowing nothing → the frontier is the foundations.
- **Search** over titles + overviews.

## Stack

Next.js 15 (App Router, TS) · embedded **`node:sqlite`** (zero-infra; recursive CTEs) ·
Cytoscape (ego-graph) · react-markdown + KaTeX.

> **Slice decision:** the brief targets Postgres as the primary store. This slice uses
> embedded SQLite so it runs with zero setup. All SQL is standard (the recursive
> prerequisite CTE is the only non-trivial query), so the port to Postgres + `pgvector`
> for semantic search is mechanical. See `db/schema.sql`.

## Run

```bash
pnpm install
pnpm run import          # imports C:\Users\natan\Mathematics\Notes by default
                         # or: pnpm run import "C:\path\to\OtherVault\Notes"
pnpm run dev             # http://localhost:3000
```

The importer is idempotent: it rebuilds `nodes` and `edges` on each run but preserves
your `user_knows` state.

## Current graph

767 concepts · 3,064 relationships · 1,046 typed prerequisites · 92 gaps.

## Next steps

- **AI edge-typing pass**: upgrade the 1,972 `related` edges into specific types with
  confidence + an approval queue (the brief's "suggested edges" workflow, bootstrapped
  from content you already wrote).
- **Learning-path generation**: shortest path through `depends_on` from known → target.
- **Semantic search**: pgvector embeddings over statements (after the Postgres port).
- **DAG hygiene**: surface `depends_on` cycles as data-quality issues to resolve.

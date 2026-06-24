# Proofer

**An AI tutor that models your understanding of mathematics**, built on a typed
knowledge graph bootstrapped from an existing Obsidian vault. See [VISION.md](VISION.md)
for the strategy and the moat.

The graph is the skeleton; the product is the tutor living on it. Proofer infers your
mastery of each concept from your performance on generated problems (not a "known"
button), traces a wrong answer to the specific *prerequisite* you're missing, and grades
your free-form proofs/explanations — the things a chatbot structurally cannot do because
it has no persistent model of *you*.

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
- **The tutor loop** (`/learn`) — generate a targeted problem for a concept → you answer in
  free form → an LLM grades it, names the specific gap, attributes it to a prerequisite, and
  gives a Socratic hint (never the answer) → **Bayesian Knowledge Tracing** updates your mastery,
  which feeds back into the frontier. Every attempt is logged (the seed of the misconception dataset).
- **Search** over titles + overviews.

> **AI is real but optional, and the default path is free.** Problem generation and grading
> work with **Google Gemini's free tier** (`gemini-2.0-flash`, structured JSON output) — set
> `GEMINI_API_KEY` (free key, no card, at aistudio.google.com). The **Anthropic Claude** path
> (`claude-opus-4-8`, best grading quality) is also wired in for when `ANTHROPIC_API_KEY` is set
> on a funded account. With neither, Proofer runs in **demo mode** (templated problems,
> length-based grading) so the loop is still runnable. Provider logic is isolated in `lib/llm.ts`.

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
cp .env.local.example .env.local   # optional: add ANTHROPIC_API_KEY for real AI tutoring
pnpm run import          # imports C:\Users\natan\Mathematics\Notes by default
                         # or: pnpm run import "C:\path\to\OtherVault\Notes"
pnpm run dev             # http://localhost:3000  ·  practice at /learn
```

The importer is idempotent: it rebuilds `nodes` and `edges` on each run but preserves
your `user_knows` state.

## Current graph

767 concepts · 3,064 relationships · 1,046 typed prerequisites · 92 gaps.

## Next steps

The original next-steps shipped: **AI edge-typing** (`classifyEdge` + the `/quality`
approval queue), **learning-path generation** (`learningPath()` known→target), and
**DAG hygiene** (`dependencyCycles()` surfaced in `/quality`) are all live, alongside
spaced-repetition retention, exam mode, voice input, and an AI study planner. The
roadmap has moved up a level — see [VISION.md](VISION.md) for the ambitious bets:

- **Formal verification (Lean/Mathlib)** — kernel-check proofs so grading can't hallucinate.
- **The misconception graph** — cluster logged gaps into named misconceptions, multi-user,
  predictive.
- **Bring-your-own-course ingestion** — map a syllabus / notes / problem set onto the graph.
- **Postgres + `pgvector`** — the substrate for semantic search, course-alignment, and
  misconception clustering (the SQLite → Postgres port is mechanical).

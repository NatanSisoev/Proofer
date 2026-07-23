# Proofer

**An AI tutor that models your understanding of mathematics**, built on a typed
knowledge graph bootstrapped from an existing Obsidian vault. See [VISION.md](VISION.md)
for the strategy and the moat.

The graph is the skeleton; the product is the tutor living on it. Proofer infers your
mastery of each concept from your performance on generated problems (not a "known"
button), traces a wrong answer to the specific *prerequisite* you're missing, and grades
your free-form proofs/explanations — the things a chatbot structurally cannot do because
it has no persistent model of *you*.

## What's here

The graph skeleton and the tutor living on it are both built out well past the original
MVP slice. Grouped by pillar:

**The graph (skeleton).**
- **Vault importer** (`scripts/import-vault.mjs`) — walks an Obsidian math vault, turns each
  note into a typed node (from frontmatter `type`/`field`), and classifies every
  `[[wikilink]]` into a typed edge based on *which section* it appears in (a link in a
  Statement is a prerequisite; "equivalent" in Connections is an equivalence; …).
  Unresolved links become **ghost nodes** — explicit gaps in the graph. Multi-source
  (`--source=<name>`) so several courses coexist without clobbering each other.
- **Node page** — rendered statement/proof (KaTeX, plus embedded **TikZ** figures compiled
  to SVG and cached), an **ego-graph** and a **prerequisite dependency graph** of the local
  neighborhood, typed incoming/outgoing relationships, personal notes, and per-concept history.
- **Explore / Map / Browse** — the whole graph by area or as an interactive mastery-colored map.
- **`/quality`** — ghost-node gaps, dependency cycles, unclassified edges (with an **AI
  edge-typing** approval queue), unlinked-mention link suggestions, and misconception review.

**Inferred mastery, not self-report (Pillar 1).**
- **Bayesian Knowledge Tracing** over graded attempts — a wrong answer nudges the blamed
  prerequisite down, demonstrated use nudges prerequisites up. No "I know this" button.
- **Knowledge frontier** (concepts whose every prerequisite you already know, ranked by
  unlock potential), **readiness** scoring, and **spaced-repetition retention** (per-concept
  half-life, a "due today" queue, a review forecast, and streak insurance with earned freezes).
- **Information-gain problem selection** and **calibration** — predict-your-confidence before
  answering, a running Brier score, and a home-page "blind spots" surface for overconfidence.

**Diagnosis, not delivery (Pillar 2).**
- **The tutor loop** (`/learn`, `/session`) — generate a targeted problem → answer free-form
  (or by voice) → an LLM grades it, names the specific gap, attributes it to a prerequisite,
  and gives a Socratic hint that withholds the answer → BKT update → frontier recompute.
  **Multi-turn Socratic remediation** lets you address the gap without restarting.
- **Learning Pathways** (`/path/[target]`) — a guided known→target lane built live from
  current mastery. **Misconception clustering** groups a concept's recorded gaps into named
  misconceptions (`/quality?tab=misconceptions`).

**Proof of understanding via generation (Pillar 3).**
- **Trust-labelled grading** — for proof/counterexample problems an adversarial second pass
  tries to break an answer the primary grader called "correct"; every verdict carries a trust
  level (model-judged / cross-checked / refuted) rather than a bare thumbs-up.

**Around the loop:** session modes (smart/due/weak/blind-spots/area/bookmarks/custom) and a
timed **exam mode** with pacing targets; **semantic search** over local embeddings; Anki
export; bookmarks, daily goals, and an activity calendar; light/dark themes.

> **AI is real but optional, and the default path is free.** Problem generation and grading
> work with **Google Gemini's free tier** (`gemini-2.0-flash`, structured JSON output) — set
> `GEMINI_API_KEY` (free key, no card, at aistudio.google.com). The **Anthropic Claude** path
> (`claude-opus-4-8`, best grading quality) is also wired in for when `ANTHROPIC_API_KEY` is set
> on a funded account. With neither, Proofer runs in **demo mode** (templated problems,
> length-based grading) so the loop is still runnable. Provider logic is isolated in `lib/llm.ts`.

## Stack

Next.js 15 (App Router, TS) · embedded **`node:sqlite`** (zero-infra; recursive CTEs) ·
Cytoscape (ego-graph + dependency graph) · react-markdown + KaTeX · node-tikzjax (TikZ→SVG).

> **Slice decision:** the brief targets Postgres as the primary store. This slice uses
> embedded SQLite so it runs with zero setup. All SQL is standard (the recursive
> prerequisite CTE is the only non-trivial query), so the port to Postgres + `pgvector`
> for semantic search is mechanical. See `db/schema.sql`.

## Run

```bash
pnpm install
cp .env.local.example .env.local   # optional: add GEMINI_API_KEY (free) for real AI tutoring
pnpm run import          # imports C:\Users\natan\Mathematics\Notes by default
                         # or: pnpm run import "C:\path\to\OtherVault\Notes"
pnpm run dev             # http://localhost:3000  ·  practice at /learn
```

The importer is idempotent: it rebuilds `nodes` and `edges` on each run but preserves
your mastery, attempts, and other user-state tables.

**Multiple vaults.** `--source=<name>` (default `main`) scopes the rebuild to just that
source's own nodes/edges, so a second vault doesn't wipe the first:

```bash
pnpm run import -- --source=matcad "C:\path\to\MatCAD\Notes"
```

A course note's `[[Compactness]]` still resolves to the main vault's existing node
instead of spawning a duplicate ghost — cross-source links just work.

**Bringing in a real course (MatCAD/Mates raw materials, not pre-written atomic notes).**
Proofer's importer only understands atomic notes (frontmatter `type`/`field` +
`[[wikilinks]]`) — it does not parse lecture PDFs directly, and there's no in-app
uploader (that's blocked on the multi-user/Postgres bet, deferred with launch). The
workflow is a one-time-per-course conversion, done with the `summarize-pdf` and
`math-note` Claude Code skills already used for the Mathematics vault:

1. For each lecture PDF/presentation: `summarize-pdf` → a markdown note with the
   structure the importer expects, saved into a dedicated course folder.
2. For any concept it references that doesn't have a note yet: `math-note` to write
   one in the same folder (or `[[wikilink]]` it and let the importer create a ghost —
   `/quality` surfaces those as gaps to fill later).
3. `pnpm run import -- --source=<course> <path-to-course-folder>`.

Re-run step 3 after adding more notes — it's idempotent and only touches that course's
own source.

## Current graph

767 concepts · 3,069 relationships · 1,049 typed prerequisites · 93 gaps.

## Next steps

Almost everything the original roadmap scoped has shipped (see [IMPROVEMENT_PLAN.md](IMPROVEMENT_PLAN.md)
for the cycle-by-cycle log). What remains is bounded by two deliberate cuts — **no Lean
kernel** and **no multi-user/launch infra** — so the open bets in [VISION.md](VISION.md) are
the ones those cuts gate:

- **Formal verification (Lean/Mathlib)** — kernel-check proofs so grading can't hallucinate.
  *Cut for now; approximated by trust-labelled adversarial grading instead of a real kernel.*
- **The misconception graph, cross-user** — single-user clustering ships today; the
  compounding, predictive, multi-student version needs the shared substrate below.
- **In-app bring-your-own-course ingestion** — the vault-import wedge works per-course today;
  an in-product uploader (parse a syllabus / problem set directly) is blocked on that substrate.
- **Postgres + `pgvector` + accounts** — the one infra move that unblocks the three above;
  all current SQL is standard and embeddings already run locally, so the port is mechanical.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Proofer is an AI tutor for mathematics built on a typed knowledge graph (Next.js 15 App
Router + TypeScript, embedded `node:sqlite`). The graph is bootstrapped by importing an
Obsidian vault of math notes; the product layer infers per-concept mastery from graded
practice attempts (Bayesian Knowledge Tracing), not a manual "known" toggle. See
[README.md](README.md) and [VISION.md](VISION.md) for product framing, and
[IMPROVEMENT_PLAN.md](IMPROVEMENT_PLAN.md) for the live backlog/status of past work.

## Commands

```bash
pnpm install
pnpm run dev              # http://localhost:3000, Turbopack
pnpm run build             # production build
pnpm run start             # run a production build
pnpm run import             # re-import the vault (default: C:\Users\natan\Mathematics\Notes)
pnpm run import "C:\path\to\OtherVault\Notes"   # import a different vault
pnpm run check-db           # sanity-check table row counts in data/graph.db
npx tsc --noEmit            # typecheck — there is no separate lint command
pnpm run test               # node:test seatbelt for the pure math (BKT, entropy, cycles, truncateMath)
```

All scripts set `NODE_OPTIONS=--experimental-sqlite` (via `cross-env`) because `node:sqlite`
is still experimental. `pnpm run test` (via `tsx`) covers only the handful of pure functions
where a silent regression would be hard to notice by eye (`lib/mastery.ts`'s BKT posterior/
half-life math, `lib/queries.ts`'s cycle canonicalization, `lib/text.ts`'s `truncateMath`) —
it is a seatbelt, not full coverage. `tsc --noEmit` plus manual exercising via `pnpm run dev`
(or Claude Preview tools if available) remain the primary correctness checks for everything
else.

The importer is idempotent: it rebuilds `nodes` and `edges` on every run from the vault
files, but preserves `mastery`, `attempts`, `bookmarks`, `node_notes`, and `settings`.

## Git workflow

**Work directly on `main` and commit there.** This is a solo project; the owner asked to stop
the branch-per-change / PR overhead. Do NOT create feature branches or open PRs for routine
work — make the change, verify it, and commit straight to `main`. (`origin/main` is a public
GitHub repo, `NatanSisoev/Proofer`.)

- `main` must always stay in a working state: `npx tsc --noEmit` passes and the app actually
  runs before each commit. Never skip the typecheck to land a change faster.
- **Commit each logical change as its own commit** with message `<type>: <imperative summary>`,
  matching the established types in `git log`: `feat`, `fix`, `style` (pure CSS/inline-style
  extraction, no behavior change), `design` (visual/UX rework), `refactor`, `perf`, `chore`,
  `docs`. Add a body only when the *why* isn't obvious from the diff. If a turn produced several
  unrelated changes, make several commits rather than one mixed one.
- **Push after committing** (`git push`) so `origin/main` stays current — no work should sit
  only locally.
- Never force-push `main`. Never rewrite already-pushed history.
- **Never end a turn with a dirty working tree.** If a response actually changed code (not just
  exploration/reading), commit it to `main` before finishing — "I'll commit it later" is how this
  repo ended up with files committed mid-write (`04f2cb0` was a cleanup for exactly that).
  `git status` clean is the exit condition for any turn that touched files, not an optional nicety.

## Architecture

**Data flow:** `scripts/import-vault.mjs` walks an Obsidian vault → parses frontmatter
(`type`, `field`) and `[[wikilinks]]` per note → classifies each link into a typed edge
based on *which section* it appears in (a link in "Statement" is a prerequisite; "equivalent"
in "Connections" is an `equivalent_to`; etc.) → writes `nodes`/`edges` into
`data/graph.db` (SQLite). Unresolved links become **ghost nodes** (`exists_ = 0`) — explicit
gaps in the graph, surfaced on `/quality`.

**Schema** (`db/schema.sql`, applied via `CREATE TABLE IF NOT EXISTS` on every `db()` call,
so new tables appear without re-importing):
- `nodes` / `edges` — the graph itself (typed, directed edges: `depends_on`, `generalizes`,
  `equivalent_to`, `instance_of`, `proven_by`, `contradicts`, `related`).
- `mastery` / `mastery_history` — inferred P(understood) per node, updated by BKT, plus a
  spaced-repetition `half_life` (days; doubles on success, halves on failure) that drives
  the "due for review" surface.
- `attempts` — every generated problem + free-form answer + verdict + the specific
  prerequisite the grader blamed for the gap. This log is the product's long-term moat.
- `problems` — generated problem bodies/ideal solutions/rubrics, keyed so the student only
  ever sees a `problemId`, never the answer key, until they ask to reveal it.
- `llm_cache` — SHA-256(fn + inputs)-keyed cache for read-only LLM calls (explain/compare),
  7-day TTL enforced in `lib/llm.ts`; cleared on vault sync.
- `misconceptions` — named misconception clusters per concept, produced by an LLM batch
  pass over that concept's accumulated `attempts.gap` texts (reviewed/saved via
  `/quality?tab=misconceptions`), shown on the node page next to "Grader blamed".
- `bookmarks`, `node_notes`, `settings` — small user-state tables.

**`lib/db.ts`** holds the SQLite singleton (`global.__prooferDb`, survives HMR) and patches
`StatementSync.prototype.all/get` to return plain objects — `node:sqlite` returns
null-prototype objects, which React rejects when passed from a Server Component to a
Client Component.

**`lib/mastery.ts`** is the BKT engine: `applyAttempt(nodeId, evidence, blamedPrereq,
directPrereqs)` computes the posterior from grader-supplied evidence, nudges prerequisite
mastery up on strong performance / blamed-prerequisite mastery down, and updates the
spaced-repetition half-life. `MASTERY_THRESHOLD` (0.8) in `lib/db.ts` is the single
definition of "known" used everywhere (frontier, readiness, due-for-review queries).

**`lib/queries.ts`** (~1100 lines) is the query layer for every page: prerequisite-closure
traversal (recursive CTE, cycle-safe), readiness scoring, the "knowledge frontier" (concepts
whose every prerequisite is already known, ranked by unlock potential), due-for-review,
weak spots, area mastery, search, quality-dashboard queries (gaps, dependency cycles,
unclassified edges), etc. Most page components are thin wrappers around these.

**`lib/llm.ts`** isolates all provider logic — the only file that knows about Gemini vs.
Anthropic. Provider selection is `GEMINI_API_KEY` → Gemini (free tier) → else
`ANTHROPIC_API_KEY` → Anthropic (`claude-opus-4-8`) → else demo mode (templated problems,
length-based grading, no network calls). `HAS_KEY`/`PROVIDER`/`providerInfo()` from this
module gate every AI-dependent UI element and API route — check `HAS_KEY` before adding
anything that calls an LLM.

**The tutor loop** (`/learn`, `/session`, components `StudyQueue.tsx` + `SessionSetup.tsx` +
`ProblemCard.tsx`): pick a node → `POST /api/practice/generate` produces a problem (or
serves a demo one) → student answers free-form → `POST /api/practice/grade` returns a
verdict, names the gap, attributes it to a prerequisite, and gives a Socratic hint (never
the answer) → `applyAttempt` updates mastery → `recordAttempt` logs it. Session modes
(`smart`, `due`, `weak`, `bookmarks`, `area`, custom node list) are built in
`app/api/session/queue/route.ts`.

**Conventions worth knowing before editing:**
- All app code is Next.js 15 App Router; data-fetching pages are React Server Components
  calling `lib/queries.ts` directly (no client-side fetch needed for initial render).
- `node:sqlite` is kept external via `serverExternalPackages` in `next.config.mjs` — don't
  try to bundle it.
- `lib/verdict.ts` (`VERDICT` map) and `lib/text.ts` (`truncateMath`, which avoids splitting
  `$...$` LaTeX spans) are shared single-source-of-truth utilities — reuse them rather than
  re-deriving verdict colors or truncation logic in a component.
- Styling is plain CSS in `app/globals.css` using CSS custom properties (`--bg`, `--panel`,
  `--accent`, `--green`/`--amber`/`--red` + `-soft` variants, etc.) with a `[data-theme="dark"]`
  override block — there is no CSS framework/Tailwind. New UI should reuse existing
  `--*` tokens and existing classes (`.panel`, `.pill`, `.btn-primary`/`.btn-ghost`, `.bar`)
  rather than introducing new color literals.
- Math rendering goes through `react-markdown` + `remark-math` + `rehype-katex`
  (`app/components/Markdown.tsx` / `MathText.tsx`); never hand-roll LaTeX rendering elsewhere.

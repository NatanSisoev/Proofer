# Proofer — Improvement Plan

The live backlog. Worked in cycles: each cycle is a prioritized list; items ship
as individual typed commits on `main` (tsc green, verified in the preview) and get
marked ✅ here. When a cycle is exhausted, a fresh audit/planning pass writes the
next one.

**Companion docs:** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (the original
next-level bets — status table below), [LAUNCH_PLAN.md](LAUNCH_PLAN.md) (hosting/
multi-user, deferred), [LEARNING_PATHWAYS.md](LEARNING_PATHWAYS.md) (guided lane —
phase 1 shipped, M4/M5 remain), [VISION.md](VISION.md) (thesis).

---

## Cycle 1 (2026-07-02 → 2026-07-03) — ✅ fully shipped

From a full code audit; every item landed (`e3dc3ff..310226a`). Compressed record
— details in git history and the per-item commits:

- **P0** — browse/graph consolidated into `/explore` (redirect stubs, all links +
  `b`/`g` shortcuts migrated, ListView N+1 fixed).
- **P1** — five audit bugs: NUL byte in `queries.ts`, UTC→localtime day
  boundaries, hardcoded `0.8` → `MASTERY_THRESHOLD`, LIKE-wildcard escaping,
  stale "map of mathematics" metadata. Plus one found live: **`P_TRANSIT` was a
  flat bonus** — a nonsense answer raised mastery 0→14 %; now scaled by evidence
  (`625d02c`).
- **P2** — LLM free-text calls unified behind `geminiText`/`anthropicText`
  (header auth, no key-in-URL), explain/re-explain/compare **stream**,
  `conceptOfDay` no longer loads every note body, StudyQueue keyboard listener
  fixed, dead `user_knows` dropped, `pnpm run check-db` + Node `engines` pin,
  **`node:test` seatbelt** for BKT/cycles/truncateMath (`pnpm run test`).
- **P3** — per-session calibration readout on the summary screen; **misconception
  clustering MVP** (LLM-grouped `attempts.gap` per concept, `/quality` approval
  tab, node-page surfacing, `misconceptions` table); **Learning Pathways phase 1**
  (`/path/[target]`, read-dots from note sections + quiz-dots via the existing
  loop, mastery gate, no persistence — recomputed from live mastery); exam-mode
  confidence gate removed; "why this pick" tooltips on info-gain queue items.
- **P6** — tab/filter easing unified, reduced-motion + `:focus-visible` support,
  mobile panel padding; node-page mobile CTA verified fine as-is.

**Decisions made this cycle (don't relitigate):**
- **Lean verification (bet 1): CUT** (2026-07-03). Autoformalizing free-form
  student proofs is too brittle — no standalone verifier service. Grading trust
  is now pursued without a kernel: see Cycle 2 #2.
- **Launch (P5): DEFERRED** — no audience yet. The Option-A checklist lives in
  [LAUNCH_PLAN.md](LAUNCH_PLAN.md); don't start it preemptively.
- Earlier cuts stand: study plan (`dcf4286`), flashcards (`0879252`).

---

## Cycle 2 (2026-07-03) — ACTIVE

Six directions, in execution order. Constraints honored: no Lean, no launch/
multi-user infra — everything below runs on the current local SQLite stack.

### 1. Back up the moat (do first — trivial, protects everything) — ✅ done

All attempts, mastery, calibration history, and misconceptions live in one
gitignored SQLite file (`data/graph.db`) on one laptop. Losing it is losing the
product's premise.

- **Fix**: lazy daily backup inside `db()` (`lib/db.ts`) — on first open of a
  new (local) day, snapshot via `VACUUM INTO 'data/backups/graph-YYYY-MM-DD.db'`
  (WAL-safe, produces a consistent single file), keep the newest 14, gitignore
  `data/backups/`. Add a "Download backup" button in `/settings` that streams
  a fresh `VACUUM INTO` snapshot.
- **Effort**: Low (an hour). **Impact**: existential insurance for the dataset
  VISION.md calls the 3-year moat.
- Shipped: `maybeBackup()` in `lib/db.ts` runs on every `db()` call but only
  does file I/O once per local day (string-compare guard), prunes to newest
  14 via sorted filename glob. `app/api/backup/route.ts` streams an on-demand
  `VACUUM INTO` snapshot as a download. `data/` was already gitignored
  wholesale, so no `.gitignore` change was needed.

### 2. Trustworthy grading without Lean — ✅ fully shipped (2a, 2b, 2c)

VISION's honest gap #1 ("grading still trusts an LLM about math") survives the
Lean cut — but the failure mode (the grader blesses a wrong proof) has cheaper
attacks than a kernel. Three independent sub-items, in order:

- **2a. Rubric-point grading.** ✅ done — Problems already carry a `rubric`
  (JSON array on `problems`). Changed the grade schema (`gGradeSchema` / the
  Anthropic prompt in `lib/llm.ts`) so the grader returns a per-point
  `{met, note}` array (zipped against our own rubric text so the model never
  retypes it) instead of a holistic verdict; `gradeAnswer` derives
  `verdict`/`mastery_evidence` from rubric coverage and pins `gap` to the
  first unmet point. Checklist rendered in `GradeFeedback`
  (`ProblemCard.tsx`, replacing the old "What you got" list) — green/red rows
  with per-point notes. Demo-mode `stubGrade` updated to the same shape.
  Verified live against Gemini in the preview (Fourier Coefficient problem,
  1/5 points met → 13% mastery, correct gap pin).
- **2b. Adversarial verification pass.** ✅ done — When the verdict is
  `correct` on a `prove`/`counterexample` problem (`ADVERSARIAL_KINDS` in
  `app/api/practice/grade/route.ts`) and a key is configured, fire one extra
  `refuteAnswer` call (`lib/llm.ts`) prompted purely to *refute* the student's
  argument (false step, missing case, circular reasoning, invalid
  counterexample; defaults to "holds" if nothing concrete is found — and in
  demo mode, since there's no model to run it). If the refuter finds a hole:
  downgrade verdict to `partial`, cap `mastery_evidence` at 0.5, and surface
  both views — the rubric checklist (still all-green, since it *did* satisfy
  every rubric point) plus a new red "Second look" block with the refuter's
  specific objection. An additive `attempts.trust` column
  (`model-judged | cross-checked | refuted`, via `MIGRATIONS`) tracks the
  outcome; `gradingTrustStats()` in `lib/queries.ts` computes the
  **disagreement rate** (refuted / cross-checked), surfaced as a "Grading
  trust" panel on `/progress` once ≥3 samples exist. Verified live: a correct
  aperiodicity proof got `trust: "cross-checked"`, refutation empty, UI showed
  no extra block — confirms the guard conditions work in both directions.
- **2c. Trust labels.** ✅ done — The `attempts.trust` column landed early as
  part of 2b (it's what the disagreement rate is computed from); this item
  was the UI half. New shared `TrustBadge` component (silent for the
  `model-judged` baseline, a green "cross-checked" or red "refuted" pill
  otherwise) wired into `GradeFeedback` (next to the verdict pill) and every
  history surface: `/history`, `/progress` (recent attempts), `/node/[slug]`
  (past practice). `nodeAttemptDetails`/`attemptHistory`/`AttemptRow` queries
  extended to select `trust`. (The label taxonomy leaves room for a future
  `numerically-verified` tier — a `compute`-kind spot-check with mathjs —
  but that's optional follow-on, not part of this item.)
- **Effort**: 2a Medium, 2b Low–Medium, 2c Low. **Impact**: directly attacks the
  "tutor wrong about math is fatal" risk VISION names, with measurable results.

### 3. Local embedding layer — the pgvector dividend without Postgres

Embed every node once; store the vector in SQLite; brute-force cosine over ~767
nodes is sub-millisecond in JS. No new infra, and the code ports to pgvector
mechanically if bet 0 ever happens.

- **Schema**: additive `nodes.embedding BLOB` + `nodes.embedding_hash TEXT`
  (hash of `title+overview+statement` so unchanged notes skip re-embedding on
  re-import; embeddings survive `DELETE FROM nodes` via re-embed-if-hash-known…
  simplest: keep an `embeddings(node_id, hash, vector)` table that the importer
  preserves, like mastery).
- **Provider**: `lib/llm.ts` gains `embedText(texts[])` — Gemini embeddings
  endpoint on the free tier (default `gemini-embedding-001`, env-overridable);
  no key → feature off everywhere (same `hasKey()` gating pattern).
- **Backfill**: `scripts/embed.mjs` (+ `pnpm run embed`), batched, cached by
  hash; also invoked at the end of vault sync when a key exists.
- **Consumers, in order of payoff**:
  1. `searchWithMastery` becomes **hybrid**: vector recall + exact/prefix boost
     (keeps the readiness badges untouched).
  2. `linkSuggestions` v2: nearest-neighbor pairs with no existing edge replace
     the O(n²) substring scan — better recall (paraphrases, notation variants),
     same `/quality` approval UX.
  3. `similarConcepts` goes cross-area (currently same-area only).
  4. Misconception clustering upgrade: embed `attempts.gap` texts and cluster
     by cosine before LLM labeling (better groups than text-only prompting).
- **Effort**: Medium. **Impact**: four features from one column, plus the
  ingestion on-ramp.

### 4. Point it at the real degree (multi-source import + exam pacing)

The falsifiable test is *"beats Anki + ChatGPT for one real course"* — and the
real courses are MatCAD/Mates, not the polished Mathematics vault. Make Proofer
the daily driver for an actual UAB course.

- **4a. Multi-source import.** Today `import-vault.mjs` is winner-takes-all
  (`DELETE FROM edges; DELETE FROM nodes;`, one vault path). Add
  `nodes.source TEXT` (additive migration; default `"main"`), a
  `--source=<name>` flag that deletes/rebuilds only that source's nodes and
  edges, and make `resolveTarget` consult the **existing `nodes` table** as well
  as the in-run map — so a course note's `[[Compactness]]` resolves to the main
  vault's node instead of spawning a ghost. Surface source as a filter chip in
  `/explore` and a scope in `SessionSetup`.
- **4b. Content pipeline (workflow, not app code).** Lecture PDFs → atomic notes
  via the existing `summarize-pdf`/`math-note` skills into a course folder →
  `pnpm run import -- --source=<course> <path>`. Document it in the README so
  the loop doesn't try to build an in-app uploader (that's bet 3, deferred).
- **4c. Exam pacing.** Per-source/area exam date (settings key), and a home
  panel: days left, unmastered count in scope, required pace vs. actual 7-day
  velocity ("23 to go · 2.1/day needed · you're at 1.4 — behind"). Links to
  `/session?mode=area&…`. Reuses `masteryVelocity`/`areaMastery` math.
- **Effort**: 4a Medium, 4c Low–Medium. **Impact**: the app starts answering its
  own 3-month test with real coursework — and every later feature gets real
  usage data.

### 5. Multi-turn Socratic remediation

The post-verdict follow-up is one-shot (`submitFollowUp` re-grades against the
same problem). A real tutor iterates.

- **Fix**: a bounded dialogue on the graded attempt: new
  `/api/practice/dialogue` route holding a transcript (additive
  `attempts.dialogue TEXT` JSON column), grader-as-tutor prompt that sees the
  problem, the answer, the identified gap, and prior turns; asks one probing
  question per turn, max ~4 turns; the final turn returns an updated
  `mastery_evidence` applied as a *small* BKT nudge (cap the swing — dialogue
  refines, it doesn't re-grade). UI: a thread under `GradeFeedback`, replacing
  the single follow-up box.
- **Effort**: Medium. **Impact**: the most tutor-like surface in the app; pure
  prompt + state work on existing plumbing.

### 6. Validate the retention model against real data

The half-life rule (×2 on success, ×0.5 on failure, ×1.2 partial) was hand-tuned.
There's now enough review history to start checking it instead of trusting it.

- **Fix**: for every attempt on a previously-practiced concept, compute predicted
  recall at attempt time (`0.5^(days_elapsed / half_life)`) and compare with the
  outcome. New `/progress` panel: predicted-vs-actual pass rate in recall
  buckets (calibration curve for the *scheduler*, mirroring the student Brier
  panel). If systematically off, tune the multipliers (they're constants in
  `lib/mastery.ts`, now covered by tests). Guard the panel behind a minimum
  sample size — with today's ~40 attempts it should say "collecting data", not
  draw noise.
- **Effort**: Low–Medium. **Impact**: keeps "due today" honest; groundwork for
  FSRS-style parameters later.

### Ad hoc — user-requested, done out of plan order

- **Review + redo a past attempt.** ✅ done (2026-07-03) — every history
  surface (`/history`, `/progress` recent attempts, `/node/[slug]` past
  practice) now links to `/attempt/[id]`: the original problem statement,
  the answer given at the time, and the gap/blamed-prerequisite, plus an
  editable "Try again" box pre-filled with the original answer. Submitting
  re-grades against the *same* `problems` row (new `attempts.problem_id`
  column, additive migration) — a fresh attempt, a fresh mastery update, and
  the same `GradeFeedback` UI as a live session, including its built-in
  follow-up box for continued Socratic back-and-forth. Attempts recorded
  before this column existed show a graceful "predates this feature" notice
  with a link to practice the concept fresh instead. New:
  `app/attempt/[id]/page.tsx`, `app/components/AttemptReviewPanel.tsx`,
  `lib/queries.ts#getAttempt`.

### 7. Smaller candidates (fill-in items, any order)

- **PWA pass**: manifest + icons + sane mobile practice check, so sessions work
  from a phone (no offline ambition — the LLM needs network anyway).
- **Time-boxed sessions**: "give me 20 minutes" in `SessionSetup` → queue length
  from the tracked avg seconds/problem.
- **Interleaved smart queue**: mix due-reviews into `smart` mode (currently
  separate modes) — spacing science says interleave, and it uses signals that
  already exist.
- **Streak insurance**: one earned "freeze" token per week of hits — habit
  design; keeps the streak honest but not brittle.

---

## The big bets — status after the cuts

| Bet ([IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)) | Status |
|---|---|
| 4b Calibration | ✅ shipped (+ session readout, blind spots) |
| 4a Info-gain selection | ✅ shipped (+ legibility tooltips) |
| 1 Lean verification | ❌ **cut** — replaced by Cycle 2 #2 (trust without a kernel) |
| 0 Postgres + pgvector + auth | deferred with launch; Cycle 2 #3 delivers the embeddings dividend locally |
| 2 Misconception graph (full) | MVP shipped; Cycle 2 #3.4 upgrades clustering; cross-user version still needs bet 0 |
| 3 Course ingestion | Cycle 2 #4 is the single-user wedge (own courses via vault import); in-app upload stays blocked on bet 0 |

## Launch — deferred gate (unchanged)

No audience yet (2026-07-03). When that changes, execute the Option-A slice in
[LAUNCH_PLAN.md](LAUNCH_PLAN.md) (env-only keys + hide key UI, disable vault
write-back routes on the server, rate-limit practice/node APIs, fresh
`graph.db`, VM host with a persistent volume). Until then: don't build for it.

## Design & UX — standing directive (continuous)

Owner is still iterating toward a design he likes. One polish tick per loop
iteration stays the rule; remaining known candidates: SessionSetup custom chip
styles, breadcrumb separator refinement, `/settings` visual pass (it's the last
page untouched by the redesign waves), empty-state audit on the new `/path` and
misconceptions surfaces.

---

## Execution notes for the loop

- Work Cycle 2 top-down (1 → 6), #7 and design ticks as fill-in.
- One coherent, verified slice per iteration; big items (2, 3, 4) split into
  their lettered sub-items — each sub-item is a legitimate tick.
- Mark items ✅ here (with the commit hash) as they land; when Cycle 2 is
  exhausted, ask for a fresh planning pass instead of inventing items.
- Anything requiring a product decision (launch, cutting a feature, new paid
  dependencies): ask, mark blocked, move on.

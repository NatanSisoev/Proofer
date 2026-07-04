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

## Cycle 2 (2026-07-03 → 2026-07-04) — ✅ fully shipped

Six directions plus fill-ins; every item landed (`53869fb..dc6f52c`).
Compressed record — details in git history, the per-item commits, and
IMPLEMENTATION_PLAN.md:

- **#1 Back up the moat** — lazy daily SQLite snapshots (`VACUUM INTO`,
  gitignored, newest 14 kept) inside `db()`, plus an on-demand "Download
  backup" button in `/settings`.
- **#2 Trustworthy grading without Lean** — rubric-point grading (a per-point
  checklist instead of a holistic verdict), an adversarial second pass that
  tries to refute an already-"correct" proof/counterexample before trusting
  it, and `attempts.trust` labels (`model-judged`/`cross-checked`/`refuted`)
  with a disagreement-rate panel on `/progress`.
- **#3 Local embedding layer** — an `embeddings` table, a Gemini
  `embedText`/`hasEmbeddings()` provider (paced under the free-tier quota),
  `pnpm run embed` backfill (hash-cached, chained from vault sync), and
  `searchHybrid()` as a semantic fallback in the live search typeahead.
  **Slice 1 only** — three planned consumers (`linkSuggestions` v2, cross-area
  `similarConcepts`, misconception pre-clustering) are still **blocked**:
  backfill coverage is ~11% (82/767 nodes as of 2026-07-04) under the
  free-tier quota, too sparse to trust.
- **#4 Point it at the real degree** — a `--source` flag on the importer
  (scoped rebuild + cross-source link resolution so a second vault's links
  resolve to the main vault instead of spawning duplicate ghosts), a
  documented PDF→note conversion workflow (`summarize-pdf`/`math-note`
  skills), and per-area exam-date pacing (days-left / pace-needed /
  actual-pace panel on Settings + home page). **Deferred sub-slice**: the
  `/explore` filter chip and `SessionSetup` source-scope UI are still
  **blocked** — no second-source vault exists yet (100% of nodes are still
  `source = 'main'`).
- **#5 Multi-turn Socratic remediation** — a bounded (4-student-turn) chat
  dialogue on a graded attempt, replacing the old one-shot re-grade; a
  capped, dampened mastery nudge from the final turn; shared chat-bubble UI
  across live sessions and historical review.
- **#6 Retention model validation** — `retentionCalibration()` replays each
  node's half-life history against actual review outcomes into a
  predicted-vs-actual panel on `/progress`, guarded behind a 30-sample floor.
- **#7 Smaller candidates** — PWA manifest/icons, time-boxed sessions ("give
  me N minutes" → a concept count from tracked per-problem pace), an
  interleaved smart queue (due reviews spread through the session instead of
  front-loaded), and streak insurance (earned freeze tokens auto-bridge a
  missed day).
- **Ad hoc** — review-and-redo any past attempt from every history surface,
  re-grading against the original problem instead of only viewing it.
- **Design/UX ticks** — the exam-pacing date input themed for dark mode, the
  custom-chip remove-button hover state, breadcrumb separator spacing
  unified across all four breadcrumbs, and the `/path`/misconceptions empty
  states brought onto the shared `EmptyState` component.

**Decisions made this cycle:** none — the backlog as scoped at cycle-open
shipped in full. The two sub-slices above (`#3`'s remaining consumers, `#4`'s
source-scope UI) are carried forward as still-blocked-on-data, not cut — see
Cycle 3's "carried forward" list below.

## Cycle 3 (2026-07-04) — ACTIVE

From a fresh audit prompted by Cycle 2's exhaustion: a re-read of
VISION.md/IMPLEMENTATION_PLAN.md/LEARNING_PATHWAYS.md against what's actually
shipped, plus four parallel codebase sweeps (tech debt/dead code, API-route
consistency, query performance, UX/doc staleness) — findings verified by hand
before landing here, not taken on faith. Constraints unchanged: no Lean, no
launch/multi-user infra.

### 1. Silent-mutation-failure audit — ✅ done (2026-07-04, `75718a8`)

The quick pass over `app/components/*.tsx` widened the confirmed list from
three to **six** (the sweep's three plus `KnownButton` — optimistic toggle,
never reverts; `GoalButton` — caught network errors but flipped state on any
resolved response including a 500; `SnoozeButton` — showed "snoozed 2d" on a
500, no catch at all). Everything else with a POST already handled failure
(`NodeActions`/`GhostCreate`/`SyncButton` check `res.ok`; the LLM panels have
their own error states; `ExamPacingSettings` gates state on `res.ok`).

- **Shared fix, not ErrorBanner**: for these tiny inline controls a banner
  outweighs the control, so instead: check `res.ok`, revert the optimistic
  state, and flip the control into a transient red "Failed — click to retry"
  treatment for ~3s (new `useTransientFlag` hook + `.btn-failed` class; the
  control stays clickable, so the failed state *is* the retry affordance).
- **`PersonalNotes` is the exception**: its failure message is persistent
  (cleared only by a subsequent successful save), because a false "Saved"
  there is silent data loss — the footer reads "Couldn't save — your text is
  still here; editing or clicking away retries" until a save lands.
- **Verified live** by monkey-patching `window.fetch` in the preview to force
  500s on the target endpoints: BookmarkButton went Save → (forced 500) →
  red "Failed" with retry tooltip + reverted state → auto-cleared back to
  "Save" 3s later, and the DB confirmed no row was written; with the patch
  removed the same click persisted ("Saved") and was then toggled back off.
  PersonalNotes showed the persistent failure footer during the forced
  outage (no false "Saved") and a real "Saved HH:MM" once restored. All
  test bookmarks/notes cleaned up afterward; `tsc --noEmit` + `pnpm run
  test` green. The other four components share the exact pattern verified
  by those two (one `useTransition`-optimistic, one debounced-save).

### 2. Learning Pathways M4 — adaptive remediation detours

`LEARNING_PATHWAYS.md`'s M4 milestone is unbuilt: today a failed quiz-dot in
`/path/[target]` just sits there. `blamed_prerequisite` is already captured on
every graded attempt, but the lane never acts on it. This is Pillar 2
("diagnosis, not delivery") applied to the guided path specifically, and it's
the most thesis-aligned, fully-unblocked, well-scoped feature left on the
table.

- On a failed quiz dot whose `blamed_prerequisite` is itself unmastered and
  not already in the lane's spine, splice that prerequisite's mini-unit in as
  a visually-marked detour immediately before the current dot (an indented
  branch per the design doc — the main spine should still read as stable, not
  get re-shuffled). Return to the original dot once the detour's mastery gate
  clears.
- `pathway()` (`lib/pathway.ts`) already derives everything live from current
  mastery, so this is mostly new state/UI in `PathwayLane.tsx` plus a small
  addition to unit-building to detect and inject the detour unit.

**Effort**: Medium. **Impact**: turns the guided path from a checklist into
the thing the whole product claims to uniquely do.

### 3. Learning Pathways — read-dot calibration signal + M5 remainder

Two smaller follow-ups on the same feature:
- **Read-dot "Got it / Not sure" is currently inert.** `PathwayLane.tsx`'s
  `CurrentUnit` advances local `readIndex` React state on click but calls no
  API at all — `LEARNING_PATHWAYS.md` §3 point 4 explicitly designs this as
  feeding the calibration signal ("a section you marked 'got it' but then
  fail the quiz on is a textbook blind spot"). Wire it to actually record
  something so the blind-spot machinery can eventually use it.
- **M5 remainder**: review-dot interleaving (resurface a due review from an
  earlier, already-cleared unit while walking the lane) and a "unit complete"
  celebration beat (reuse the session-summary treatment). The home-page entry
  point ("Learning goal" panel → "Guided path" CTA) already shipped in phase
  1 — that part of M5 is done, don't redo it.

**Effort**: Low–Medium. **Impact**: closes the gap between the documented
design and what actually ships; mostly polish once #2 lands.

### 4. Quick wins — mechanical, low-risk, bundle into one tick

- **Dedupe `localDateStr()`** — byte-identical function defined separately in
  `lib/db.ts:23` and `lib/queries.ts:13`. Export the one in `lib/db.ts` and
  import it in `lib/queries.ts`.
- **Add `idx_attempts_verdict` / `idx_attempts_kind`** — `attemptHistory()`
  (`lib/queries.ts:733-735`) filters `/history` by `a.verdict`/`a.kind` on
  demand with neither column indexed (only `node_id` and `created_at` are).
  Harmless at ~50 rows today; cheap insurance before it's 1,000+.
- **JSON-parse guards** on the couple of routes still missing a try/catch
  around `req.json()` (e.g. `practice/reveal`, `practice/hint`) — defensive,
  not a currently-observed failure (the app only ever calls itself with
  `JSON.stringify`'d bodies), but a clean 400 beats a raw 500 if that ever
  changes.

**Effort**: Low. **Impact**: small, safe correctness/maintainability wins with
no product-visible change.

### 5. README refresh

`README.md`'s "What's here" section predates most of Cycle 2: multi-turn
Socratic dialogue, grading-trust labels, local embeddings/semantic search,
Learning Pathways, exam pacing + multi-source import, and the streak/freeze
system are all live and unmentioned. Update the feature list and "Next steps"
section to reflect current reality.

**Effort**: Low. **Impact**: no code risk; matters if this is ever shown to
anyone (a collaborator, or future-you).

---

**Carried forward, still blocked on data (not code) — re-check periodically,
don't re-attempt until the blocker actually clears:**
- Cycle 2 #3's remaining embedding consumers (`linkSuggestions` v2, cross-area
  `similarConcepts`, misconception pre-clustering) — coverage is ~11%
  (82/767 nodes) as of 2026-07-04. `SELECT COUNT(*) FROM embeddings` to
  re-check; keep running `pnpm run embed` to build coverage in the meantime.
- Cycle 2 #4's `/explore` filter chip + `SessionSetup` source-scope UI — no
  second-source vault exists yet.
- VISION.md's bet 0 (Postgres/pgvector/multi-user), the full misconception
  graph (needs bet 0's cross-user density), and full course-ingestion (needs
  bet 0's embeddings + accounts) — all correctly gated behind "no audience yet."

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
iteration stays the rule; current candidate found in the Cycle 3 audit:

- **`/session` and `/quality` header consistency** — both still use the older
  `header.top` pattern (bare `<h1>` + `<span className="tag">`, a
  border-bottom divider) while every other redesigned page (`/explore`,
  `/progress`, `/path`, `/settings`, `/history`, `/attempt/[id]`) uses
  `page-top`. Worth a look to see whether normalizing is a real improvement
  or whether `header.top`'s divider actually reads better for these two
  specific list-heavy pages — a judgment call, not a clear-cut bug.

- **Empty-state audit — `/path` and misconceptions.** ✅ done (2026-07-03) —
  two inconsistencies found: `MisconceptionCandidates`' "not enough attempts
  yet" state was a bare `<p className="muted empty-state">` — the only empty
  state in the app not using the shared `EmptyState` icon-circle component
  (`LinkSuggestions`/`QualityFilters`/`SessionSetup`/`explore`/`progress` all
  already did). Switched it to `EmptyState` with a `Lightbulb` icon; removed
  the now-dead `.empty-state` CSS rule. Separately, `/path`'s no-goal-set
  landing was a bare `<h1>` flush at the very top of an otherwise-empty page
  — no `page-top` header treatment (unlike its `/path/[target]` sibling), no
  icon, just a paragraph and a button in a lot of dead space. Gave it the
  same `page-top` (h1 + subtitle) pattern as `/path/[target]`, and swapped
  the plain paragraph for an `EmptyState` (`Sparkles` icon) with the CTA
  button centered underneath. **Verified live**: temporarily raised
  `misconceptionCandidates`' `minGaps` to 999 and cleared/restored the
  `learning_goal` setting to exercise both empty states directly (10 real
  misconception candidates and a real learning goal both exist normally, so
  neither empty state is reachable without this), screenshotted both,
  confirmed no console errors, then restored the real data/setting.
  `tsc --noEmit` and `pnpm run test` clean.
- **Breadcrumb separator refinement.** ✅ done (2026-07-03) — `.breadcrumb`
  is a flex container (`display: flex; gap: 6px`), but each of the four
  breadcrumbs (`node/[slug]`, `explore` area view, `learn`, `path/[target]`)
  built its "·" separator ad hoc. Most just padded the dot with literal
  spaces — harmless, since CSS collapses whitespace at the edges of its own
  flex item, so it was a no-op visually — but `path/[target]` additionally
  wrapped an explicit `{" "}` in its own JSX expression *before* the
  separator text, which floats it in as a fourth, distinct flex item and
  earns its own 6px gap — giving that one breadcrumb an extra ~6px of dead
  space the other three didn't have. Removed the stray `{" "}` and stopped
  padding "·" with spaces everywhere, so every breadcrumb relies solely on
  the flex gap for spacing. **Verified live**: measured the DOM gap (via
  `Range.getBoundingClientRect()` on the separator text node) on all four
  breadcrumbs — all now read an identical 6px, where `path/[target]`
  previously measured wider; screenshotted a node page to confirm no visual
  regression; `tsc --noEmit` and `pnpm run test` clean.
- **SessionSetup custom chip styles.** ✅ done (2026-07-03) — the chip itself
  (`.selected-chip`, accent-soft background/border) was already fine; the
  bug was its remove (×) button. `.chip-remove:hover` used a hardcoded
  `rgba(0, 0, 0, 0.08)` overlay — the only hardcoded-black hover treatment
  in the whole stylesheet (every other hover state uses a `var(--*)` token)
  — which barely darkens the chip's already-dark `--accent-soft` background
  in dark mode, giving almost no visible hover feedback. Swapped for
  `background: var(--accent); color: white`, the same treatment
  `.unlocked-node-chip:hover` already uses elsewhere. **Verified live**: in
  `/session`'s Custom mode, added a concept and confirmed the chip renders
  correctly in both dark and light theme (screenshotted both); confirmed no
  console errors and `tsc --noEmit` clean.
- **`/settings` visual pass.** ✅ done (2026-07-03) — turned out the page
  already used the redesigned `panel`/`page-top`/`action-row`/`btn-primary`
  vocabulary throughout (it wasn't actually untouched, just not re-verified
  since the redesign waves). The one real inconsistency, found by reviewing
  the full page in both themes: `input[type="date"]` (the exam-pacing target
  picker) was missing from the shared themed-input selector in
  `globals.css`, so it rendered as a raw white browser widget — background,
  text, and the native calendar icon/popup all ignored the dark theme.
  Added `input[type="date"]` to the themed-input rule and
  `[data-theme="dark"] input[type="date"] { color-scheme: dark }` so the
  native picker follows suit. **Verified live**: inspected computed styles
  in both themes — dark now shows `background: rgb(38,36,32)`,
  `color-scheme: dark`; light unaffected (`color-scheme: normal`,
  light colors) — confirmed via screenshot in both.

---

## Execution notes for the loop

- Work Cycle 3 top-down (1 → 5), design ticks as fill-in.
- One coherent, verified slice per iteration.
- Mark items ✅ here as they land; when Cycle 3 is exhausted, ask for a fresh
  planning pass instead of inventing items.
- Anything requiring a product decision (launch, cutting a feature, new paid
  dependencies): ask, mark blocked, move on.

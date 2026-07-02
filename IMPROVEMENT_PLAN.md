# Proofer — Improvement Plan (2026-07-02)

A fresh, prioritized roadmap from a full code audit (every page, `lib/*`, the LLM
layer, schema, and all planning docs). The previous plan (2026-06-25) is **fully
shipped** — its P0–P4 items all landed (see git history for the old file). This
plan is the successor backlog.

**Companion docs:** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (the four
next-level bets — status recap below), [LAUNCH_PLAN.md](LAUNCH_PLAN.md) (hosting/
multi-user), [LEARNING_PATHWAYS.md](LEARNING_PATHWAYS.md) (guided-lane concept),
[DESIGN_MIGRATION_PLAN.md](DESIGN_MIGRATION_PLAN.md) (Claude-aesthetic migration,
essentially complete).

## Where the app stands

- **Everything in the 2026-06-25 plan shipped**: ISR + `loading.tsx` everywhere it
  matters, async vault sync with lock, LLM cache + thinking disabled, the
  `/learn`→`StudyQueue` merge (shared `ProblemCard`), exam mode, unlock preview,
  streak/velocity fixes, edge-classification approval queue.
- **From IMPLEMENTATION_PLAN's bets**: 4b Calibration ✅ (confidence gate + Brier +
  blind spots), 4a info-gain selection ✅ (`selectNext` policy + difficulty
  targeting). Lean verification (1), Postgres/pgvector/multi-user (0), course
  ingestion (3), misconception clustering (2) — **not started**.
- **Cut features**: study plan (`dcf4286`), flashcards (`0879252`) — both
  deliberate; don't resurrect.
- **Half-finished**: the browse/map→explore merge. `/explore` shipped with three
  view modes (`973f9f2`) but the old routes and most links to them survive — see
  P0 #1, the single biggest cleanup in this plan.

---

## P0 — Finish the explore merge (one coherent navigation model)

### 1. ✅ `/browse` and `/graph` duplicate `/explore` wholesale
`app/explore/page.tsx` `SectionsView` (L61–160) is a near-verbatim copy of
`app/browse/page.tsx`, and its `MapView` (L162–179) copies `app/graph/page.tsx`.
Both old routes still render, and most of the app still links to them:

- `app/page.tsx:345` ("Browse all") and `:352` (area rows → `/browse?area=`)
- `app/node/[slug]/page.tsx:118` (breadcrumb), `:120` (area link), `:381`
  ("Browse all {area}")
- `app/components/StudyQueue.tsx:419` (summary area links)
- `app/components/KeyboardShortcuts.tsx:49–50` (`b` → `/browse`, `g` → `/graph`)

Any styling or behavior change now has to be made twice, and users land on two
different URLs for the same thing depending on entry point.

- **Fix**: migrate every link/shortcut to `/explore?view=…&area=…`; replace
  `app/browse/page.tsx` and `app/graph/page.tsx` with `redirect()` stubs that
  preserve `area` (keep old URLs working — they're in browser histories); delete
  the `ALIASES` entries in `NavLinks.tsx` once nothing links to the old paths.
- **Also**: `ListView` (`app/explore/page.tsx:198–203`) does an N+1 loop —
  `nodesInArea()` per area — then re-filters and re-sorts in JS what SQL already
  did. Add one `allNodesWithMastery(type?, sort?)` query instead.
- **Effort**: Low–Medium. **Impact**: High — kills ~340 duplicated lines and the
  "two names for the same page" confusion.

---

## P1 — Correctness bugs (all small, all real)

1. ✅ **NUL byte in `lib/queries.ts:903`.** The cycle-dedup key is
   `rotated.join("<literal \0>")` — a raw NUL character in the source. It's valid
   TS (tsc passes) but makes the repo's most important file **binary to
   ripgrep/grep**: `Grep` on `lib/queries.ts` returns "binary file matches" and
   content searches silently skip it. Replace the literal with the escape
   `"\u0000"` (identical semantics — NUL can't occur in node ids, which is why it
   was chosen as separator).
2. ✅ **Day boundaries are UTC; the user is in Europe/Madrid.** `todayStats()`
   (`lib/queries.ts:934`), `activityCalendar()` (`:971`), `masteryVelocity()`
   (`:994`), `reviewForecast()` (`:217`), and `masteryMilestones()` (`:1215`) all
   bucket by `date(created_at)` / `date('now')` / `toISOString().slice(0,10)` —
   UTC days. Practicing at 00:30 local counts toward *yesterday*: the streak can
   falsely break (or falsely survive), the daily goal resets at 1–2 AM instead of
   midnight, and the heatmap shifts. Fix consistently: use SQLite's
   `'localtime'` modifier (`date(created_at,'localtime')`, `date('now','localtime')`)
   and local-date formatting on the JS side (both sides must agree).
3. ✅ **`MASTERY_THRESHOLD` isn't the single source of truth it claims to be.**
   Hardcoded `0.8` appears in `browseAreas` (`lib/queries.ts:445`),
   `masteryVelocity` (`:1002`), `masteryMilestones` (`:1223`), `areaMastery`
   (`:1251`), and the node-page "mastered" badge
   (`app/node/[slug]/page.tsx:154`). If the threshold is ever tuned, these
   silently disagree with the frontier/readiness model. One sweep to interpolate
   the constant.
4. ✅ **Search mangles literal `%`/`_`.** `searchWithMastery`
   (`lib/queries.ts:670`) strips `%` and `_` from the query instead of escaping
   them (`LIKE ? ESCAPE '\'`). Searching `a_n` or anything with an underscore
   (common in math slugs) silently matches the wrong thing.
5. ✅ **Stale site metadata.** `app/layout.tsx:13–16` still says *"Proofer — a map
   of mathematics · A typed knowledge graph of mathematical concepts"* — the
   pre-pivot positioning. The home page's own tagline is "AI tutor that models
   your understanding of mathematics". Update `<title>`/description (and check
   `app/opengraph-image.tsx` for matching copy) to the tutor framing.
6. ✅ **A garbage answer could still raise mastery.** Found live (not in the
   original audit) while testing P2 #7's new seatbelt: `bktUpdate()` in
   `lib/mastery.ts` applied the `P_TRANSIT` (0.12) "practice teaches" bonus
   unconditionally. A never-practiced concept graded with evidence=0 (an
   off-topic/nonsense answer) still jumped from 0% to ~14% mastery on the flat
   bonus alone — exactly backwards for a tutor whose premise is refusing to
   let you fool yourself. Fixed by scaling the bonus by evidence (a correct
   answer, evidence=1, is unaffected).

---

## P2 — Code health (pays for itself on the next feature)

1. ✅ **Unify the LLM call paths.** `lib/llm.ts` has a good shared `geminiCall()`
   (header auth, structured JSON, thinking disabled) — but four functions still
   hand-roll their own `fetch`: `explainConcept` (L269), `diagnoseWeakness`
   (L372), `compareConcepts` (L572), `reExplainConcept` (L635). Each duplicates
   error handling and passes the **API key in the URL query string** (`?key=`),
   which leaks into any server/proxy log line, unlike `geminiCall`'s
   `x-goog-api-key` header. Add one `geminiText(system, prompt, opts)` helper +
   one `anthropicText(...)` helper; each feature becomes a prompt + cache-key
   pair. Also delete the **dead Anthropic JSON schemas** (`A_PROBLEM_SCHEMA`,
   `aGradeSchema`, L483–510) — defined, never referenced.
2. ✅ **Stream the long-form calls.** The one surviving piece of the old "P0 #4":
   explain / re-explain / compare block the UI until the whole response lands
   (~5–15 s perceived freeze). Switch those routes to
   `streamGenerateContent` / Anthropic streaming and render incrementally in
   `ReExplain` / `CompareWith` / the explain flow. Do it *after* (1) so there's
   exactly one streaming implementation.
3. ✅ **`conceptOfDay()` loads every candidate's full note body on every home
   render.** `lib/queries.ts:1114–1157` does `SELECT n.*` (including `content`)
   for **all** frontier candidates, then keeps one row — on the full 767-node
   vault that's potentially hundreds of full markdown bodies per `/` visit
   (which is `force-dynamic`). Select only the columns the spotlight card needs,
   or `LIMIT 1 OFFSET (dayIdx % count)`.
4. ✅ **`StudyQueue` keyboard effect re-subscribes every render.** The
   `useEffect` at `app/components/StudyQueue.tsx:198–219` has **no dependency
   array**, so every keystroke-triggered render tears down and re-adds the
   window listener. Harmless today, but it's the kind of thing that bites when
   the handler gains state. Give it deps (or a ref-based handler).
5. ✅ **Drop the dead `user_knows` table.** `db/schema.sql:42` admits it's
   "kept for back-compat; mastery is now the source of truth" — nothing reads
   it. Remove from schema + importer preserve-list + `check-db.mjs`.
6. ✅ **Make `check-db` runnable as documented.** `node scripts/check-db.mjs`
   fails on modern Node without `--experimental-sqlite` (CLAUDE.md documents the
   bare form). Add `"check-db": "cross-env NODE_OPTIONS=--experimental-sqlite node scripts/check-db.mjs"`
   to `package.json` and update CLAUDE.md. Consider an `"engines"` field pinning
   the supported Node range while at it.
7. ✅ **A minimal test layer for the math that must not drift.** There is no test
   suite at all; `tsc --noEmit` can't catch a wrong BKT posterior. The highest-value
   targets are pure functions: `applyAttempt`'s posterior math and half-life
   factors (`lib/mastery.ts`), `masteryEntropy`/`infoGainScore`,
   `dependencyCycles` canonicalization, `truncateMath`. The built-in `node:test`
   runner + `tsx` loader covers these with zero framework lock-in
   (`pnpm run test` → `node --test`). Keep it to ~a dozen assertions; this is a
   seatbelt, not a testing culture shift.

---

## P3 — Product features (thesis-aligned, no new infra)

Ranked by value-per-effort given VISION.md's pillars:

1. ✅ **Show calibration on the session summary.** Confidence is collected on every
   attempt (when enabled), but the done screen (`StudyQueue` L352–507) never
   reflects it back — the loop "you said 80 %, you scored 50 %" closes only on
   `/progress`, later, if ever. Thread `predicted` into `resultsByIndex`, and on
   the summary show per-session Brier + a one-liner ("overconfident by ~20 pp on
   3 concepts"). Small change, and it's the *"refuses to let you fool yourself"*
   moment made visible at the exact time it lands hardest.
2. ✅ **Misconception clustering MVP — single-user, no pgvector.** VISION bet #2
   scoped down to what today's stack supports: a batch job (reuse the
   `/quality` approval-queue pattern) that feeds each concept's accumulated
   `attempts.gap` texts to the LLM and asks for named misconception clusters
   ("confuses pointwise with uniform convergence"), stored in a small
   `misconceptions` table and surfaced on the node page next to "Grader blamed".
   With 36 attempts it's thin today — but it turns the log into the *product*
   the vision describes, and the schema/UX survive the later multi-user +
   embeddings upgrade intact.
3. **Learning Pathways, phase 1.** The concept doc is written
   ([LEARNING_PATHWAYS.md](LEARNING_PATHWAYS.md)); the ingredients exist
   (`learningPath()` ordering, note sections from the importer, generate/grade
   loop, mastery gate at the threshold, half-life scheduler). Ship the minimal
   lane: pick target (default = the existing Learning Goal), render the
   unit/dot lane, read-dots from note sections, quiz-dots via the existing
   problem flow, gate on p ≥ 0.8. This is the guided-learning surface that
   replaced the cut "study plan" feature — and the most differentiated UI the
   app would have.
4. ✅ **Exam mode × calibration friction.** With calibration on, Submit is disabled
   until a confidence is picked (`StudyQueue.tsx:654`) — under an exam
   countdown that's hostile. Auto-suppress the confidence gate in exam mode (or
   make it optional there). One conditional.
5. ✅ **"Why this problem" transparency.** Queue items already carry a `reason`
   tag (due / weak / blind spot). Extend the info-gain path to say *why* ("closest
   to your mastery edge", "you rate this 30 pp above your results") in the
   `reason-tag` tooltip — selection policy becomes legible, which builds trust in
   smart mode.

---

## P4 — The big bets (unchanged, status updated)

Tracked in detail in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md); current
status:

| Bet | Status | Next concrete step |
|---|---|---|
| 4b Calibration | ✅ shipped | P3 #1 above (summary readout) |
| 4a Info-gain selection | ✅ shipped | P3 #5 above (legibility) |
| 1 Lean verification | not started — **the flagship** | M1: standalone verifier container + `/verify` + `LEAN_VERIFIER_URL` health badge in `/settings`; no grading change yet |
| 0 Postgres + pgvector + auth | not started | Decide **after** the launch question (P5) — Option A launch doesn't need it; Option B does |
| 2 Misconception graph (full) | MVP on-ramp shipped (P3 #2) | Full version needs embeddings + multi-user (bet 0) to cluster *across* students, not just within one concept |
| 3 Course ingestion | not started | blocked on bet 0 (embeddings + accounts) |

---

## P5 — Launch readiness (decision gate)

[LAUNCH_PLAN.md](LAUNCH_PLAN.md) is thorough; nothing from it has been executed.
The concrete Option-A slice (shared demo, "look but don't trust it"):

1. `LAUNCH_MODE=shared` env flag: hides the API-key fields in `/settings`
   (env-only keys), disables `SyncButton` and vault write-back routes
   (`/api/node/[id]/improve`, `/api/node/[id]/create` — they `writeFileSync`
   into the local vault and mean nothing on a server).
2. Rate-limit `/api/practice/*` + `/api/node/*` (simple in-memory token bucket —
   one instance is the plan anyway) + provider spend alert.
3. Fresh `data/graph.db` for the public instance (mastery/attempts are personal
   history; the importer only rebuilds nodes/edges).
4. Fly.io/Railway with a persistent volume; smoke-test generate→grade→quality.

Worth doing when there's someone to show it to; P0–P2 first regardless.

---

## P6 — Design & UX polish (standing directive, continuous)

The design overhaul directive stands (owner still iterating toward liking it).
Specific candidates found this pass, beyond the memory's running list
(SessionSetup chips, breadcrumb separator, tab-CSS consistency):

1. **Three different "tab" implementations** — `/quality` filter tabs,
   `/progress` `ProgressTabs`, node-page `NodePanels` accordion headers. One
   `.tabs` class family would unify hover/active/focus treatment.
2. **Node page two-column `grid` on mobile** — the side column (`node-side-col`,
   panels) stacks below the full note; on long notes the practice CTA is a
   screen-height away. Consider a sticky compact action bar on small viewports.
3. **Home page length** — spotlight + due + goal + blind spots + frontier +
   bookmarks + areas + recent is a lot of stacked panels; consider collapsing
   the lower third behind "More" or tightening panel paddings at `<900px`.
4. ✅ **`prefers-reduced-motion` / `:focus-visible` audit** — hover-lift
   micro-interactions landed (`e437709`); make sure keyboard focus and reduced
   motion get the same care (one CSS block each). Added a `prefers-reduced-motion`
   block (near-zero transition/animation duration, hover-lift transforms
   cancelled) and fixed a real `:focus-visible` gap: `select:focus` unconditionally
   set `outline: none` with only a subtle border-color change as the replacement —
   every dropdown site-wide had no visible keyboard-focus indicator. Now
   `outline: none` only applies to non-keyboard focus (`:not(:focus-visible)`),
   same pattern applied to `.global-search-input`.
5. ✅ **Keyboard shortcuts drift** — `b`/`g` still point at dead routes: already
   fixed as part of P0 #1 (`KeyboardShortcuts.tsx` routes both to `/explore?view=…`).
   The "add `e` → `/explore`" sub-suggestion is now stale/superseded — `e` already
   routes to `/session` ("Study session"), a more valuable binding than a second
   route to Explore when `b`/`g` already cover its two view modes. No code change
   needed beyond the P0 #1 fix already shipped.

---

## Suggested execution order

1. **Day 1–2:** P0 #1 (explore consolidation + link/shortcut migration) and all
   of P1 — every item is under an hour, several are one-liners.
2. **Week 1:** P2 #1–2 (LLM unification, then streaming) — the biggest remaining
   *felt* latency win; P2 #3–6 as filler commits; P3 #1 and #4 (both small).
3. **Week 2:** P2 #7 (test seatbelt) before touching mastery math again; then
   P3 #2 (misconception MVP).
4. **Week 3+:** P3 #3 (Pathways phase 1) — the flagship product surface; Lean M1
   (P4) in parallel as the flagship *correctness* bet.
5. **Continuous:** one P6 design tick per loop iteration, as established.
6. **Gate:** revisit P5 (launch) once P0–P2 are clean; the answer decides whether
   bet 0 (Postgres/auth) enters the critical path.

Each item ships as its own `type: summary` commit on `main`, typecheck green,
per CLAUDE.md.

# Proofer — Master Improvement Plan

A prioritized roadmap from first-hand code review (Next.js 15 App Router + TS,
embedded `node:sqlite`, Gemini/Claude LLM layer, Cytoscape graph). Organized by
**performance** (top priority — "extremely slow"), **bugs**, **redundant
features**, **new features**, and **design polish** (building on the Phase 1
light redesign already shipped in `adb1765`/`f2dab18`/`241a6a7`).

Dataset is tiny (4.1MB, 36 problems, 17 attempts) — slowness is **architectural**,
not data volume. Fix architecture first; everything else compounds on top of it.

---

## ✅ Status as of 2026-06-20

Most P0–P2 items are complete. Summary of what's shipped:

- **P0 #1** ✅ `/browse` ISR (revalidate=30), `/quality` ISR (revalidate=60/120). Remaining `force-dynamic` routes are correctly per-user (mastery, attempts).
- **P0 #2** ✅ `loading.tsx` Suspense skeletons added for all 8 major routes.
- **P0 #3** ✅ Vault sync is async (`execFileAsync`), module-scoped lock prevents double-sync.
- **P0 #4** ✅ `thinkingConfig: { thinkingBudget: 0 }` on all 5 free-form LLM call sites.
- **P0 #5** ✅ LLM response cache — SQLite-backed, 7-day TTL, cleared on vault sync.
- **P0 #6** ✅ `/quality` ISR means `linkSuggestions` O(n²) runs at most once per 120s.
- **P0 #7** ✅ Cytoscape layout positions persisted to localStorage per area.
- **P1 #1** ✅ DB singleton race — stale handle left open on sync (WAL coexistence), no close.
- **P1 #2** ✅ StudyQueue "Retry missed" uses `setActiveQueue` (no `window.location` reload).
- **P2 #1** ✅ `/learn?node=X` is a 1-item `StudyQueue` — fully merged.
- **P3 #3** ✅ AI edge-typing: `classifyEdge()` + `/api/quality/edges/classify` approval queue.
- **P3 #4** ✅ Misconception signals: `nodeBlamedPrereqs` on node page, `recurringWeakPrerequisites` on `/progress`.
- **P3 #5** ✅ `dependencyCycles()` query exists; DAG hygiene surfaced in `/quality`.
- **P3 #6** ✅ Provider/model badge in `/settings` LLM panel.
- **New** ✅ Exam mode: timed session with countdown clock, auto-finish, exam-branded summary.

**Remaining backlog below.**

---

## P0 — Performance (do these first)

### 1. Remove blanket `export const dynamic = "force-dynamic"`
Every one of the 34 page/route files opts out of all Next.js caching and
prerendering. Every navigation re-runs every server query from scratch with
zero cache.

- **Fix**: Only routes that truly need per-request freshness (anything reading
  `mastery`/`attempts`/session state) need `force-dynamic`. Static-ish pages
  (`/browse`, `/quality` issue lists, area listings) can drop it or use
  `revalidate = 30` / `unstable_cache()` for the heavy aggregate queries
  (`noteQuality()`, `linkSuggestions()`, `stats()`, `browseAreas()`).
- **Effort**: Medium — audit each page, pick `force-dynamic` vs `revalidate`.
- **Impact**: Largest single perceived-speed win.

### 2. Add `loading.tsx` Suspense boundaries
Zero `loading.tsx` files exist anywhere in `app/`. Every nav shows a blank
white screen until the full server component (including all its DB + LLM
calls) resolves.

- **Fix**: Add `loading.tsx` skeletons for `/`, `/graph`, `/browse`, `/progress`,
  `/quality`, `/node/[slug]`, `/session`, `/study-plan`. Even a simple
  "panel skeleton" matching the new light design instantly fixes the "is this
  app frozen?" feeling.
- **Effort**: Low — one file per route, reuse a shared `<PageSkeleton/>`.
- **Impact**: High — turns "frozen" into "loading", same backend speed.

### 3. Fix the synchronous vault-sync route
`app/api/vault/sync/route.ts` runs `execSync(...)` with `timeout: 90_000` —
**this blocks the entire single-threaded Node process for up to 90 seconds**.
Every other request (every page, every API call) queues behind it while sync
runs.

- **Fix**: Run the import as a detached child process (`spawn` with
  `detached: true` + polling for completion / a `sync_status` row in
  `settings`), or move it to a background job queue. At minimum, switch
  `execSync` → `exec`/`spawn` (async) so the event loop isn't blocked.
- **Effort**: Medium.
- **Impact**: High if `SyncButton` is used regularly — currently every sync
  click freezes the whole app for everyone for up to 90s.

### 4. Disable Gemini "thinking" + stream the free-form LLM calls
`geminiCall()` (used for problem generation/grading) correctly sets
`thinkingConfig: { thinkingBudget: 0 }`. But **`explainConcept`,
`diagnoseWeakness`, `compareConcepts`, `reExplainConcept`, and
`generateStudyPlan`** in `lib/llm.ts` call raw `fetch()` with only
`generationConfig: { temperature, maxOutputTokens }` — no `thinkingConfig`,
no streaming. Gemini 2.5 Flash's default thinking budget can add many seconds
of latency per call, and the UI blocks fully until the whole response lands.

- **Fix**: Add `thinkingConfig: { thinkingBudget: 0 }` to all five call sites
  (or a low fixed budget if quality regresses). For `explainConcept` /
  `generateStudyPlan` (long-form output), switch to `streamGenerateContent`
  and stream tokens to the client — these are the slowest-feeling features
  today (`/study-plan`, "Explain first →", re-explain, compare).
- **Effort**: Medium (shared helper + UI streaming consumers).
- **Impact**: High — these are the features most likely to feel "stuck".

### 5. Cache LLM explain/compare/study-plan responses
No caching anywhere for LLM output. Every "Explain first →", "Compare", or
re-explain click hits the API fresh, even for the same node + same mastery
state.

- **Fix**: Cache by `(nodeId, prereqHash)` (or `(nodeId, otherNodeId)` for
  compare) in a small SQLite table or `unstable_cache`, with a short TTL (or
  invalidate on mastery change). Saves API calls and makes repeat visits instant.
- **Effort**: Low–Medium.
- **Impact**: Medium — big win for `/node/[slug]` repeat visits.

### 6. Audit `linkSuggestions()` O(n²) scan
`lib/queries.ts`'s `linkSuggestions` does a double loop over **all** nodes'
content. At 767 nodes (the full vault, per README) this is ~588K comparisons
on every `/quality?tab=links` load, computed synchronously in the request
thread — with `force-dynamic` it reruns every visit.

- **Fix**: Cache the result (it only needs to change when the graph changes —
  tie invalidation to vault sync), or precompute during `import-vault.mjs`
  and store suggestions in a table.
- **Effort**: Low (cache) → Medium (precompute).
- **Impact**: Medium, but **high once the full 767-node vault is imported** —
  currently masked by the small dev DB.

### 7. Cytoscape graph layout cost
`GlobalGraph.tsx` runs a `cose` layout with `numIter: 500` and only disables
animation above 300 nodes — at 767 nodes this is a heavy client-side layout
computed on every `/graph` visit (no caching of node positions).

- **Fix**: Persist computed layout positions (localStorage or a `node_positions`
  table) and reuse them; only re-layout on structural change. Consider a
  faster preset for >500 nodes (`grid`/`concentric` first paint, `cose` as
  progressive enhancement).
- **Effort**: Medium.
- **Impact**: Medium — mainly affects `/graph` on the full vault.

---

## P1 — Bugs / correctness

1. **Vault-sync DB singleton race**: `app/api/vault/sync/route.ts` closes
   `global.__prooferDb` and sets it to `undefined` mid-sync. If another request
   runs concurrently (likely once #3 above makes sync async/non-blocking), it
   could hit a closed/`undefined` handle. Needs a lock or a recreated
   connection guard in `lib/db.ts`.
2. **`StudyQueue` "Retry missed" does a full page reload**: clicking "Retry N
   missed" (`StudyQueue.tsx` ~L382) does `window.location.href =
   "/learn?node=..."`, dropping straight into the single-concept `/learn` flow
   and discarding the rest of the retry list — only the *first* missed concept
   is retried, the comment in the code even acknowledges this is a workaround.
   Fixing this is also a forcing function for the `/learn` vs `/session` merge
   below (#1 in Redundant Features).
3. **`StudyQueue` prefetch cache never evicted on skip**: if a user hits "Skip"
   repeatedly, `prefetchCache` entries for skipped nodes are never consumed or
   cleared — minor memory/API-call leak over a long session (low severity,
   but free to fix alongside the queue refactor).
4. **Emoji/UI debris missed in Phase 1 redesign**: `app/study-plan/page.tsx`
   still has `📅 Study Plan` in the `<h1>`, and `PracticeSession.tsx` still has
   `💡 Hint`. The Phase 1 redesign explicitly aimed to remove all emoji —
   these two were missed (see Design Polish below).

---

## P2 — Redundant / overlapping features (merge candidates)

### 1. `/learn` vs `/session` — near-duplicate practice UIs
`PracticeSession.tsx` (~500 lines) and `StudyQueue.tsx` (~700 lines) implement
**nearly identical** logic: same `Problem`/`Grade` types, same
`VERDICT_STYLE` color map (duplicated verbatim), same hint/reveal/follow-up/
explain flow, same Ctrl+Enter handling. The only real difference is
`StudyQueue` wraps it in a queue with progress dots and a summary screen.

- **Recommendation**: Make `/learn?node=X` simply launch a **1-item
  `StudyQueue`** (or extract a shared `<ProblemCard>` component used by both).
  This also fixes bug #2 above for free, and halves the surface area for
  future practice-flow changes (hints, voice input, etc. only need to be built
  once).
- **Effort**: Medium-High (careful refactor, but high long-term payoff —
  currently *every* practice-flow feature must be implemented twice).

### 2. Flashcards vs Session "weak spots"/"smart" modes
`/flashcard` builds a deck from `weakSpots(20) + bookmarkedNodes() +
frontier(30)` — the same signals `SessionSetup`'s "Weak spots" and "★
Bookmarked" session modes use, just rendered as flip-cards instead of a
problem queue. Not pure duplication (flashcards are a lighter-weight recall
mode vs. graded practice), but worth deciding: is `/flashcard` a distinct
product surface (Anki-style recall) or should it become a "mode" option inside
`/session` (e.g. a `display: "card" | "problem"` toggle)? Given VISION.md
explicitly positions Proofer *against* "Anki, except it tests whether you truly
understand" — pure flashcards arguably contradict the thesis and could either
be (a) cut, or (b) repositioned purely as a *review/skim* tool before a real
session, clearly labeled as such.

- **Recommendation**: Keep, but relabel as "Quick review" and link it from
  `/session` as a pre-session warm-up rather than a top-level nav item — reduces
  nav clutter (see Design Polish) without removing functionality.

### 3. Five near-identical "free-form LLM explanation" endpoints
`explain`, `reexplain`, `compare`, `diagnose`, and `study-plan` routes each
independently call `fetch()` to Gemini with their own prompt-building and error
handling in `lib/llm.ts`. Not removable (each serves a distinct UI need), but
**should share one streaming/caching helper** (see P0 #4/#5) instead of five
copies of the same fetch boilerplate — this is a refactor that *enables* the
performance fixes, not a separate feature cut.

---

## P3 — New features (aligned with VISION.md roadmap)

Roughly in order of value vs. effort, given the app is "at its beginnings":

1. **Surface `learningPath()` more prominently.** The recursive-CTE shortest
   known→target path already exists (`LearningPath.tsx` on `/node/[slug]`) but
   is buried in the node page. Promote it to a first-class "How do I get here?"
   action from the graph and from search results — directly serves the "always
   knows what you're ready to learn next" pitch in VISION.md.
2. **Async vault sync with progress UI.** Once #3 (P0) makes sync
   non-blocking, add a simple progress indicator (polling a `sync_status` row)
   so "Sync vault" feels safe to click instead of freezing the app.
3. **AI edge-typing pass for `related` edges** (VISION.md Phase 2): the 1,972
   `related` edges in the full vault are unclassified. An LLM batch pass to
   suggest `depends_on`/`generalizes`/etc. with a confidence score, surfaced in
   `/quality` as an approval queue, directly improves the prerequisite graph
   that the whole mastery model depends on — high leverage for a "beginnings"
   app.
4. **Misconception logging (the stated 3-year moat).** `attempts` already
   stores `gap`/`blamed_prerequisite` per attempt — nothing yet aggregates this
   across users/sessions into a "common misconceptions for concept X" view.
   Even a single-user version (show your own recurring gaps on a concept's
   page) is a cheap first step toward the dataset VISION.md describes.
5. **DAG hygiene view**: surface `depends_on` cycles (mentioned as a "next
   step" in README) — `prerequisites()` is already cycle-safe via path
   tracking, so detecting and listing cycles is mostly a query away, and feeds
   the `/quality` page as another issue type.
6. **Settings: provider/model visibility.** With three LLM tiers (Gemini →
   Anthropic → demo stub), surface *which* provider is currently answering
   (already partially done via `mode: "ai"|"demo"` on problems) consistently
   across explain/compare/study-plan too, so users understand demo-mode
   limitations everywhere, not just in practice.

---

## P4 — Design polish (continuing the Phase 1 light redesign)

Phase 1 (`adb1765`, `f2dab18`, `241a6a7`) established the light academic
palette and removed most dark-mode/emoji cruft. Remaining inconsistencies
found this pass:

1. **Remaining emoji**: `📅` in `app/study-plan/page.tsx` `<h1>`, `💡 Hint` in
   `PracticeSession.tsx`. Remove both (StudyQueue's equivalent hint button
   already has no emoji — make `/learn` consistent with it).
2. **Hardcoded hex colors bypassing CSS variables**: `VERDICT_STYLE` in both
   `PracticeSession.tsx` and `StudyQueue.tsx` hardcodes `#E8F2EC` / `#F5F0E0` /
   `#F5E8E8` instead of using `var(--green-soft)`/`var(--amber-soft)`/
   `var(--red-soft)`-style tokens. Same issue in `GlobalGraph.tsx`'s
   `EDGE_COLOR` map and `masteryColor()` function (`#C9CDD8`, `#5B8A6B`, etc.)
   and the tooltip's inline `#FAFAF8`. Centralize these into CSS variables in
   `globals.css` so the whole app (including the graph) stays in sync if the
   palette is ever tuned again, and dark mode (if added later) doesn't require
   re-touching every component.
3. **Consolidate `VERDICT_STYLE`/`VERDICT_ICON`** into a shared module (this
   falls out naturally from the `/learn`+`/session` merge in P2 #1).
4. **`/study-plan` header** uses `borderBottom: "none"` inline override on
   `<header className="top">` — check this against the Phase 1 nav/header
   conventions for consistency with other pages' headers.

---

## Suggested execution order

1. **Week 1 — perceived speed**: `loading.tsx` everywhere (P0 #2) +
   `force-dynamic` audit (P0 #1) — biggest bang-for-buck, low risk.
2. **Week 1–2 — unblock the process**: async vault sync (P0 #3) + DB
   singleton race fix (P1 #1).
3. **Week 2 — LLM latency**: disable thinking + stream explain/study-plan
   (P0 #4), add response caching (P0 #5).
4. **Week 3 — practice flow consolidation**: merge `/learn` into `/session`
   (P2 #1), which also fixes the retry bug (P1 #2/#3) and the verdict-style
   duplication (P4 #3).
5. **Week 3–4 — design cleanup**: emoji removal + CSS variable
   centralization (P4 #1–2), reposition flashcards (P2 #2).
6. **Ongoing**: link-suggestions caching (P0 #6) and graph layout caching
   (P0 #7) become urgent once the full 767-node vault is imported — do before
   that import if possible.
7. **Backlog**: VISION.md-aligned features (P3), prioritized by what's needed
   for the "does this beat Anki + ChatGPT for one real course?" test.

# Proofer — Implementation Plan for the Next-Level Bets

This plan turns the four bets in [VISION.md](VISION.md) (plus the infra unlock) into a
concrete, sequenced build. It is grounded in the current code: Next.js 15 App Router,
embedded `node:sqlite` (`lib/db.ts`), a provider-agnostic LLM layer (`lib/llm.ts`), BKT
mastery (`lib/mastery.ts`), and the existing `/quality` approval-queue pattern.

## The bets (recap)

0. **Infra unlock** — Postgres + `pgvector` + real multi-user accounts. The shared substrate.
1. **Formal verification (Lean 4 / Mathlib)** — non-hallucinating grading.
2. **The misconception graph** — cluster logged gaps, multi-user, predictive.
3. **Bring-your-own-course ingestion** — map a syllabus/notes/problem set onto the graph.
4. **Information-theoretic practice + calibration** — optimal-difficulty selection + Brier scoring.

## Dependency graph & why this order

```
        ┌─────────────────────────────────────────────┐
Phase A  │ 4b Calibration   4a Info-gain   1 Lean       │  no migration — ship on SQLite now
(now)    │ (Brier)          selection      verification │  proves the thesis, de-risks grading
        └───────┬──────────────┬────────────────┬───────┘
                │              │                │
Phase B  ┌──────┴──────────────┴────────────────┴───────┐
(infra)  │ 0 Postgres + pgvector + auth/multi-user        │  one mechanical migration
        └──────────────────────┬────────────────────────┘
                               │ (embeddings + per-user data)
Phase C  ┌────────────────────┴────────────────────────┐
(scale)  │ semantic search → 3 Course ingestion          │  alignment needs embeddings + accounts
        │                  → 2 Misconception graph        │  clustering needs embeddings + many users
        └─────────────────────────────────────────────┘
```

**Rationale.** Bets 4 and 1 need nothing new in the data layer — they deepen the loop on the
current SQLite store, so they ship first and immediately make the product more honest and more
correct (the two thesis claims). The Postgres + `pgvector` + accounts migration (bet 0) is a
single mechanical change (all SQL is standard; the recursive prerequisite CTE is the only
non-trivial query), but everything in Phase C depends on it, so it is the pivot. Bets 2 and 3
both need embeddings *and* multiple users, so they come last and share the same vector index.

Each workstream is independently shippable behind a flag and degrades gracefully (Lean falls
back to LLM grading; info-gain falls back to the current greedy `nextToPractice`; semantic
search falls back to `LIKE`). Nothing below is a big-bang rewrite.

---

## Phase A — deepen the loop on the current store

### Workstream 4b — Calibration (Brier score)  ·  smallest, highest thesis-per-line

**Objective.** Before answering, the student predicts their own correctness; we score the gap and
surface chronic over/under-confidence. This is the "refuses to let you fool yourself" pillar made
into a measured number, and it needs zero infra.

**Schema** (`db/schema.sql`, additive):
- `attempts.predicted_correct REAL` — the student's pre-answer self-rating (0..1). Nullable for
  back-compat with existing rows.

**Backend.**
- `app/api/practice/grade/route.ts`: accept `predicted` in the POST body, pass it through
  `recordAttempt` (extend the insert in `lib/mastery.ts:recordAttempt`).
- `lib/queries.ts`: add `calibration(nodeId?)` → Brier score `mean((predicted - actual)^2)` over
  attempts (actual = 1 if verdict `correct`, 0.5 partial, 0 incorrect), plus a signed bias term
  (mean `predicted - actual`) so we can say "overconfident" vs "underconfident". Per-concept and
  global.

**UI.**
- `app/components/ProblemCard.tsx`: a one-tap confidence slider/segmented control ("guess /
  unsure / confident") shown before the answer is submitted, recorded with the attempt.
- `/progress`: a "Calibration" card — Brier score, the over/under-confidence direction, and the
  concepts where the gap between belief and performance is largest (the self-deception list).

**Done when:** every graded attempt stores a prediction, `/progress` shows a calibration figure,
and the per-concept "you think you know this better than you do" list is populated.

**Risks.** Adds friction to every answer → keep it one tap, allow skipping, and make it optional
in `/settings`.

---

### Workstream 4a — Information-theoretic practice selection

**Objective.** Replace greedy "lowest-mastery frontier node" (`lib/mastery.ts:nextToPractice`)
with a policy that picks the problem whose outcome most reduces uncertainty in the mastery model,
and tunes generated difficulty toward the ~85% expected-success band (desirable difficulty).

**Approach.**
- **Selection.** For each frontier/weak candidate, compute expected information gain about its
  mastery `p`: nodes near `p ≈ MASTERY_THRESHOLD` (0.8) and with many attempts-since-movement are
  high-value; nodes already confidently known/unknown are low-value. A closed-form proxy works:
  rank by `entropy(p) * unlock_weight`, where `entropy(p) = -p·log p - (1-p)·log(1-p)` peaks at the
  decision boundary. This is a pure addition to `lib/mastery.ts`; keep the current query as the
  fallback when no candidate clears a threshold.
- **Difficulty targeting.** Thread an explicit `targetDifficulty` (derived from current `p`) into
  `generateProblem` (`lib/llm.ts:210`) and the `AUTHOR_SYSTEM` prompt: ask for a problem the
  student at confidence `p` should solve ~85% of the time. Record realized success rate per
  difficulty band to close the loop on calibration of the *generator*.

**Backend.**
- `lib/mastery.ts`: add `nextByInfoGain(candidates)` and a `selectNext(mode)` that the
  `/api/practice/next` route calls; gate on a `settings` flag `selection_policy = greedy|infogain`.
- `app/api/practice/generate/route.ts`: pass `targetDifficulty` to `generateProblem`.

**UI.** No new surface required; optionally show "why this one" ("closest to your mastery edge")
as a small caption in `ProblemCard`. Expose the policy toggle in `/settings`.

**Done when:** a session in `infogain` mode demonstrably prioritizes boundary concepts over the
lowest-`p` node, and generated difficulty shifts with mastery.

**Risks.** Info-gain can feel repetitive (it dwells at the boundary) → blend with a small
exploration term and keep the unlock weight so it still advances the frontier.

---

### Workstream 1 — Formal verification (Lean 4 / Mathlib)  ·  the flagship

**Objective.** For concepts that formalize cleanly, ground grading in the Lean kernel so a verdict
can be *checked truth*, not a model's opinion — and localize the exact failing step when it isn't.

**Architecture.** Lean cannot run in the Next.js process. Introduce a **separate verifier
service** and treat it as a third grader tier alongside Gemini/Anthropic:
- A small containerized worker (`services/lean-verifier/`) with Lean 4 + a pinned Mathlib
  toolchain, exposing `POST /verify { lean_source }` → `{ status: ok|error|timeout, message,
  failing_line? }`. Runs Lean in a sandbox with a wall-clock timeout and no network.
- Proofer talks to it over HTTP (URL from `LEAN_VERIFIER_URL`); absence of the env var = feature
  off, pure LLM grading (today's behavior).

**The grading pipeline becomes a ladder** (extends `lib/llm.ts:gradeAnswer`, the single dispatch
seam at line 217):
1. **Autoformalize the statement.** At problem-generation time, ask the LLM for an *optional*
   Lean statement of the target (theorem signature / goal) and store it on `problems`
   (`problems.lean_statement TEXT`). Only attach when the model is confident and the concept is in
   a formalizable area (start with: algebraic identities, elementary number theory, basic
   real-analysis inequalities, finite combinatorics).
2. **Transcribe the student proof.** An LLM converts the free-form answer into candidate Lean,
   *faithfully* (prompt: translate, do not repair). This is the hard, lossy step — see risks.
3. **Check.** Submit `lean_statement + transcribed proof` to the verifier.
   - Kernel **accepts** → verdict `correct`, `mastery_evidence` high, `trust = "verified"`.
   - Kernel **rejects** → use the failing line/goal to produce a *grounded* `gap` and a sharper
     `blamed_prerequisite` (the lemma/hypothesis the student failed to discharge), `trust =
     "verified-counter"`.
   - **Timeout / not formalizable / transcription failed** → fall back to LLM grading,
     `trust = "model-judged"` (today's path).

**Schema.**
- `problems.lean_statement TEXT` (nullable), `problems.formalizable INTEGER DEFAULT 0`.
- `attempts.trust TEXT` — `verified | verified-counter | model-judged` — so every verdict carries
  its provenance.

**UI.**
- `ProblemCard` verdict shows a **trust badge** ("✓ machine-checked" vs "AI-graded"). This is a
  marketing surface as much as a correctness one — it is the visible proof of the thesis.
- `/settings`: verifier status (reachable? toolchain version?) like the existing provider badge.

**Milestones.**
- **M1 — verifier service + health check.** Container, `/verify`, wired behind `LEAN_VERIFIER_URL`,
  surfaced in `/settings`. No grading change yet; prove round-trip on hand-written Lean.
- **M2 — statement autoformalization** for the beachhead areas; store + display Lean statements on
  formalizable problems (read-only).
- **M3 — proof transcription + the grading ladder**; trust badges live; LLM fallback intact.
- **M4 — failing-step → blamed prerequisite** mapping; measure agreement between kernel verdicts
  and prior LLM verdicts on the same attempts to quantify how often the LLM was blessing wrong
  proofs (the headline metric that justifies the whole bet).

**Risks / mitigations.**
- *Autoformalization is the bottleneck, not the kernel.* Keep the beachhead deliberately narrow;
  expand only as transcription reliability is measured. Never let a transcription failure block a
  student — always fall back.
- *Latency.* Verification is async and slower than an LLM call → run it after returning the LLM
  verdict and **upgrade** the attempt's trust when the kernel result lands (optimistic UI), or cap
  verification to the formalizable subset where it's fast.
- *Toolchain weight.* Pin Mathlib; cache the build in the image; the service scales independently
  of the web app.

**Done when:** at least one real area grades through the kernel end-to-end, attempts carry trust
provenance, and we can report the rate at which kernel verdicts disagree with the old LLM verdict.

---

## Phase B — the infra unlock

### Workstream 0 — Postgres + `pgvector` + multi-user

**Objective.** Move from single-user embedded SQLite to a shared Postgres with a vector index and
real accounts — the substrate Phase C requires. The README already flags this port as mechanical.

**Database migration.**
- Port `db/schema.sql` to Postgres (types: `INTEGER PRIMARY KEY AUTOINCREMENT` → `BIGSERIAL`,
  `strftime` defaults → `now()`, etc.). The recursive prerequisite CTE in `lib/queries.ts` is the
  only non-trivial query and is already standard SQL.
- Replace the `node:sqlite` singleton in `lib/db.ts` with a `pg` pool behind the **same `db()`
  surface** so call sites barely change; introduce a thin query helper to absorb the
  positional-parameter dialect difference (`?` → `$1`). Consider Drizzle/Kysely only if the
  hand-rolled SQL becomes unwieldy — not required.
- Add `pgvector`: an `embedding vector(N)` column on `nodes` (and later `attempts`) with an
  `ivfflat`/`hnsw` index.

**Multi-user.** This is the larger change, because today every table is implicitly single-user
(`mastery`, `attempts`, `bookmarks`, `node_notes`, `settings`).
- Add `users` + session auth (Auth.js / NextAuth, email + OAuth).
- Add `user_id` to all per-user tables; the **shared graph** (`nodes`, `edges`) stays global,
  per-user state is scoped. Update every query in `lib/queries.ts` / `lib/mastery.ts` to filter by
  the authenticated user (thread a `userId` through, or use Postgres RLS).
- Migration path for the existing single user: seed one `users` row and backfill `user_id`.

**Embeddings backfill.**
- Add an embeddings step to `scripts/import-vault.mjs` (or a new `scripts/embed.mjs`): embed each
  node's `title + overview + statement` and store the vector. Provider-agnostic via `lib/llm.ts`
  (Gemini/OpenAI/Voyage embeddings), cached so re-runs are cheap.

**Semantic search (the first dividend).**
- Add `searchSemantic(q)` in `lib/queries.ts` using cosine distance, and make
  `searchWithMastery` (currently `LIKE`-only, `lib/queries.ts:612`) a **hybrid**: vector recall +
  keyword exact-match boost, preserving the existing readiness badges.

**Milestones.** M1 schema port + `pg` adapter (single-user, green tests). M2 auth + `user_id`
scoping + backfill. M3 embeddings backfill + hybrid semantic search shipped.

**Risks.** Auth touches every query → land it behind a feature flag with the single-user default
preserved for local dev; add an integration test that the recursive CTE returns identical results
pre/post-port before cutting over.

---

## Phase C — scale on the new substrate

### Workstream 3 — Bring-your-own-course ingestion

**Objective.** A student drops in a syllabus / lecture notes / problem set and it is mapped onto
the graph as *their course*, reusing the existing `/quality` approval-queue UX.

**Pipeline** (`lib/ingest.ts` + `app/api/ingest/*`):
1. **Upload & extract.** Accept PDF/markdown/text; extract text (pdf parse) into sections.
2. **Concept extraction.** LLM pass → candidate concepts with type/area/statement, structured like
   `import-vault.mjs` output so it reuses the node shape.
3. **Alignment (needs pgvector).** Embed each candidate and nearest-neighbor against existing
   `nodes`. Above a similarity threshold → propose **link to existing**; below → propose **new
   node**. Detect prerequisite edges via the same section-based heuristic the importer already uses
   plus LLM edge-typing (`classifyEdge` already exists in `lib/llm.ts:680`).
4. **Approval queue.** Surface proposed nodes/edges/links in a new `/courses/[id]/review` view
   built on the existing `/quality` edge-approval pattern (accept/reject/retype). Provenance:
   tag accepted items with `source = "ingest:course:<id>"`.
5. **Course object.** `courses` table (`id, user_id, name, created_at`) + `course_nodes` mapping;
   a course becomes a session scope ("Practice my Real Analysis course") and an exam-prep target.

**Schema.** `courses`, `course_nodes`, plus `nodes.source`/`edges.source` already exist for
provenance.

**Why last:** alignment is meaningless without embeddings (bet 0), and "my course" is meaningless
without accounts (bet 0).

**Milestones.** M1 upload + extraction + concept candidates (no graph writes, preview only). M2
embedding alignment + approval queue. M3 course scoping in `/session` + an exam-prep readiness
report for a course (reuses `learningPath` + `readiness`).

**Risks.** Garbage-in from messy PDFs → keep everything behind human approval; never auto-write to
the shared graph. Duplicate-concept explosion → tune the similarity threshold and prefer linking
over creating.

---

### Workstream 2 — The misconception graph

**Objective.** Turn the passive per-attempt `gap`/`blamed_prereq` log into a living, clustered,
*predictive* layer over the concept graph — the compounding, multi-user moat.

**Build order.**
1. **Embed gaps (needs pgvector).** Backfill `attempts.gap_embedding`. New attempts embed on write
   in `lib/mastery.ts:recordAttempt`.
2. **Cluster into named misconceptions.** A periodic job (`scripts/cluster-misconceptions.mjs`)
   groups gap embeddings per concept (cosine threshold / HDBSCAN-style), and an LLM labels each
   cluster ("confuses pointwise with uniform convergence"). Store as first-class nodes:
   - `misconceptions (id, concept_id, label, centroid vector, attempt_count, updated_at)`
   - `misconception_attempts (misconception_id, attempt_id)` — membership, so the cluster grows.
3. **Attach + surface.** Show "common misconceptions on this concept" on `/node/[slug]` (already
   has `nodeBlamedPrereqs`); aggregate across users so the count compounds. This alone is the moat
   made visible.
4. **Learn transitions (the predictive payoff).** Mine sequences: which misconception cluster
   precedes which downstream error across the `depends_on` graph
   (`misconception_transitions (from_id, to_id, weight)`). When a student's recent attempts match a
   cluster centroid, **pre-empt**: bias `generateProblem` toward the concept that separates the
   confusion ("you're treating closure as interior — here's the problem that distinguishes them").
5. **Feed selection.** The matched-misconception signal becomes an input to Workstream 4a's
   selection policy and to `generateProblem`'s `recentGaps` (already threaded, `lib/llm.ts:173`) —
   upgrading per-attempt gaps to *cluster-level* targeting.

**Why last:** clustering is noise with one user's handful of attempts; the value is cross-user
density, which needs bet 0's accounts and embeddings.

**Milestones.** M1 gap embeddings + per-concept clustering job + node-page surfacing. M2 cross-user
aggregation + counts. M3 transition mining + predictive pre-emption wired into generation/selection.

**Risks.** Cold cluster quality with sparse data → don't surface clusters below a support
threshold. Privacy: aggregated misconceptions must not leak any individual's answers → store only
labels/centroids/counts in the shared view, never raw answers across users.

---

## Cross-cutting concerns

- **Feature flags.** Each workstream lands behind a `settings`/env flag with a graceful default so
  `main` is always shippable and local dev needs no new services.
- **Provider-agnostic everything.** Embeddings and the Lean verifier go through `lib/llm.ts`-style
  config selection (env/settings override), matching the existing Gemini→Anthropic→demo ladder.
- **Trust labeling is a first-class principle.** Every verdict (`attempts.trust`) and every graph
  edit (`source`) carries provenance — this is what lets us honestly market "machine-checked" and
  "your course" without overclaiming.
- **Metrics that judge each bet.** Calibration: Brier trend. Selection: attempts-to-mastery.
  Lean: kernel-vs-LLM disagreement rate. Ingestion: % candidates approved unedited. Misconception:
  predictive pre-emption hit rate. Each bet ships with the number that proves it worked.

## Suggested sequencing (one engineer, rough)

1. **4b Calibration** — days. Immediate thesis win, no infra.
2. **4a Info-gain selection** — ~1 week. Pure `lib/mastery.ts` + prompt change.
3. **1 Lean verification** — the long pole; M1–M2 in parallel with the above, M3–M4 after.
4. **0 Postgres + pgvector + auth** — the pivot; do the schema port and `pg` adapter first,
   auth second, embeddings/semantic-search third.
5. **3 Course ingestion** and **2 Misconception graph** — on the new substrate; ingestion first
   (acquisition wedge → more users → denser misconception data), misconception graph as the data
   accrues.

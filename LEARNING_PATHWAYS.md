# Learning Pathways — Concept & Implementation Plan

A Duolingo-style guided lane that **incrementally teaches** a topic: an ordered
sequence of bite-sized "dots" where some dots are **notes to read** and others are
**quizzes**, gated so you only advance once you've shown mastery. This document
explains the concept, why it fits Proofer specifically, the learning-science behind
it, and a concrete, phased build plan grounded in the existing code.

---

## 1. The idea

Today `learningPath(target)` (`lib/queries.ts:433`) produces an ordered list of the
unmastered prerequisites between what you know and a target concept, rendered as a
list of links on the node page. It tells you *what* to learn and in roughly what
order — but it doesn't **teach**. There's no "you're on step 4", no requirement to
prove mastery before moving on, and no reaction when you stumble.

The pathway turns that static list into a **guided lane of dots**, like a Duolingo
unit path:

```
  ● read: intuition of Compactness
  ● read: the statement
  ◐ quiz: state it in your own words      ← you are here
  ○ quiz: apply it to [0,1]
  ─ ── mastery gate (p ≥ 0.8) ── ─
  ○ read: intuition of Heine–Borel
  ○ quiz: …
        ⋮
  ★ TARGET: Sequential Compactness
```

Each **concept is a "unit"**; each unit expands into a short ordered run of dots
(read → recall → apply → prove); a **mastery gate** ends each unit; the **order of
units** is the dependency-graph walk toward your target.

---

## 2. Why this shape fits Proofer specifically

Most "learn X step by step" products must hand-author every lesson and every path.
Proofer doesn't, because two things already exist:

- **Note-dots are free.** The importer already splits every note by `##` headings
  into named sections — **Statement, Overview, Intuition, Motivation, Remarks,
  Proof, Connections, Examples, Counterexamples** (`scripts/import-vault.mjs`, the
  `sections()` splitter) — and the full markdown lives in `nodes.content`. A
  "read dot" is just one of those sections. Real, authored, non-hallucinated content.
- **The path order is principled, not hand-built.** The typed `depends_on` graph +
  `learningPath()` / `frontier()` give a topological order for free. Duolingo's path
  is hand-sequenced; ours is derived from genuine prerequisite structure.

So the content and the ordering — the two expensive parts of building a guided
curriculum — are already in the system. The pathway is mostly *orchestration* on top.

---

## 3. The pedagogy (why "note dot → quiz dot" is the right pattern)

The instinct is sound and well-supported, with four refinements that separate a
durable version from a shallow one:

1. **Testing effect (retrieval practice).** Being quizzed right after studying beats
   re-reading by a wide margin. The read→quiz pairing is exactly this. ✅ keep.
2. **Spacing effect.** An *immediate* quiz only tests short-term recall. Clearing a
   quiz dot should **seed a spaced review** that resurfaces days later, not be
   one-and-done. Reuse the existing half-life / `dueForReview` scheduler so the lane
   and long-term retention share one system.
3. **Worked-example effect / fading scaffolding.** Novices learn from studying
   examples; experts learn from doing. Within a unit, ramp the dots: read intuition →
   state it back → apply → prove. This ramp already exists as `ProblemKind`
   (`explain → compute → prove → counterexample`).
4. **Generation effect / desirable difficulty (the house thesis).** Passive reading
   is the weak link. End each read-dot with a one-tap **"was this clear — got it /
   not sure?"** — it keeps engagement up *and* feeds the calibration signal already
   built. A section you marked "got it" but then fail the quiz on is a textbook
   **blind spot**, and the existing blind-spot machinery can pounce on it.

Plus the obvious one — **chunking / cognitive load**: a whole theorem-plus-proof is
too big for one dot, which is precisely why section-splitting matters.

---

## 4. How it maps onto what already exists

| Pathway needs | Already in the codebase |
|---|---|
| Read-dot content | `nodes.content` + the `sections()` H2 splitter (re-parse at runtime) |
| Quiz-dot difficulty ramp | `ProblemKind` = `explain \| compute \| prove \| counterexample` |
| Quiz generation + grading + mastery update | `generateProblem` / `gradeAnswer` / BKT in `StudyQueue` |
| Mastery gate | `MASTERY_THRESHOLD` (0.8) in `lib/db.ts` |
| Unit ordering across the lane | `learningPath()` / `prerequisites()` closure + `frontier()` |
| "Next layer unlocks" advancement | `newlyUnlocked(nodeId)` (`lib/queries.ts:110`) |
| Adaptive remediation detours | `blamed_prerequisite` captured at grading time |
| Spaced review of cleared dots | half-life / `dueForReview` scheduler |
| Engagement (read-dot active beat) | calibration `ConfidenceSelect` ("got it / not sure") |
| Lesson-complete celebration | `StudyQueue` session-summary screen |

The only genuinely **new** code is the dot/step model, how a concept expands into
dots, the gating + remediation logic, and the lane (stepper) UI.

---

## 5. The core new abstraction: the `step` (a "dot")

```ts
type Step =
  | { kind: "read";  conceptId: string; section: string }         // render a note section
  | { kind: "quiz";  conceptId: string; problemKind: ProblemKind } // generate + grade a problem
  | { kind: "review"; conceptId: string };                         // a due spaced-review dot

type StepState = "locked" | "current" | "done";
```

A **unit** (one concept) expands into an ordered `Step[]`. The **lane** is those
unit step-lists concatenated in dependency order, plus interleaved `review` dots as
earlier units come due. Steps are cheap to compute, so the lane can be derived live
from mastery on each visit rather than frozen — it self-updates as you learn
elsewhere.

### How a concept expands into dots

```
unit(concept) =
  [ read: "Intuition" or "Overview" (whichever exists) ]
  [ read: "Statement" ]
  [ quiz: explain  ]      // state it back
  [ quiz: compute  ]      // apply it          (only if the concept supports it)
  [ quiz: prove    ]      // reproduce/use the proof, for Theorems/Lemmas
  → mastery gate: keep serving quiz dots until p ≥ 0.8, then unlock the next unit
```

Read sections are chosen from what the note actually has (skip missing ones). Quiz
kinds are filtered by concept `type` (no "prove" dot for a Definition). The gate
mirrors Duolingo "crown levels": the unit isn't done until BKT says it's mastered.

---

## 6. Implementation plan

Phased so each step is independently shippable and the lane is usable early.

### M1 — The pathway query (no UI yet)
- Add `pathway(targetId)` to `lib/queries.ts`: take the unmastered prerequisite
  closure (reuse `learningPath` semantics), order it as a **frontier walk** (each
  unit appears only after its own unmastered prereqs — a topological order, not just
  depth-sort), and for each concept emit its `Step[]` (read sections from
  `content` via the `sections()` splitter, quiz kinds from `type`).
- Pure function over current mastery; unit-tested with a seeded graph.
- **Done when:** `pathway("Sequential Compactness")` returns a correct, ordered dot
  list with read + quiz steps and the target last.

### M2 — The lane UI (read-dots + mark-known, no LLM needed)
- `/path/[target]` route rendering a vertical **stepper of dots** (locked / current /
  done), target pinned at the end, progress count ("4 of 11 concepts").
- Read-dots render the section markdown (reuse `Markdown.tsx` / KaTeX) with a
  **"Got it / Not sure"** footer (writes a calibration-style signal).
- Without an API key, quiz-dots fall back to "mark known" so the lane is fully
  walkable in demo mode.
- **Done when:** you can walk a target's lane end-to-end on read-dots alone.

### M3 — Quiz-dots + the mastery gate (the real loop)
- Quiz-dots drive the existing `generateProblem → gradeAnswer → BKT` loop (factor the
  shared bits out of `StudyQueue` or reuse `ProblemCard`).
- Enforce the gate: a unit's next-concept dot stays **locked** until p ≥ 0.8; keep
  serving quiz dots (escalating `ProblemKind`) until it clears.
- Cleared dots seed spaced reviews via the existing half-life update.
- **Done when:** completing a unit unlocks the next, and mastery actually gates.

### M4 — Adaptive remediation detours
- On a failed quiz dot whose `blamed_prerequisite` is unmastered, **splice that
  prerequisite's mini-unit in as a clearly-marked detour** before the current dot.
- Keep the main spine visually stable (detours render as an indented branch) so it
  still feels like a path.
- **Done when:** failing on a missing foundation visibly inserts and routes you
  through that foundation, then returns you.

### M5 — Polish / the Duolingo feel
- Review-dot interleaving when earlier units come due; "unit complete" celebration
  (reuse the session-summary); streak/XP surfacing (streaks already exist); a home
  entry point ("Continue your path") and lane creation from any node, area, or
  `/study-plan` target.

### Persistence (when needed)
- A `pathways` table `(id, target, created_at, last_position)` only if you want the
  lane to persist a chosen target and resume position across devices/sessions.
  Until then, derive the lane live from `(target, mastery)` — no new table.

---

## 7. Key decisions (settle before/while building)

1. **Read-dot content source** — vault sections (real, non-hallucinated, but uneven
   length) vs LLM-condensed (smoother, but reintroduces hallucination). **Recommend
   vault-first; the LLM may only trim/segment a long section, never invent math.**
2. **Quiz dots per unit before the gate** — one snappy dot (Duolingo-like) vs a 2–3
   kind ramp (more rigorous). Recommend: tie to mastery (crown-level style) rather
   than a fixed count.
3. **Full closure vs minimal spine** — teach every unmastered prerequisite, or just
   the shortest chain to the target. Recommend full closure with an optional
   "fast track" (shortest chain) toggle.
4. **Hard vs soft gate** — block advancement until mastered (sound) vs suggest order
   but allow skip (autonomy). Recommend hard gate with an explicit "skip ahead".
5. **Replan cadence** — fixed plan vs recompute each step. Recommend the hybrid:
   fixed target + spine, dynamic remediation insertions only.

---

## 8. Risks & mitigations

- **Note sections are uneven** (some long, some empty). → Skip empty sections; for
  over-long ones, LLM-segment into dot-sized pieces (trim only).
- **"A tutor wrong about math is fatal."** → Read-dots come from authored vault
  content; never let the LLM author the teaching text.
- **Over-reordering breaks the gamified feel.** → Stable spine; remediation as
  marked detours, not a re-shuffle.
- **Cold start / no API key.** → Lane degrades gracefully to read + mark-known; quiz
  dots light up when a key is set (same pattern as the rest of the app).
- **Lane length is intimidating** for distant targets. → Show only the current unit
  expanded + a collapsed count of what's beyond; pick nearer sub-targets first.

---

## 9. Smallest first version (the validation slice)

To feel it fast and cheaply: **M1 + M2 for a single hard-coded target.**

`pathway(target)` → `/path/[target]` stepper → read-dots (Intuition, Statement) with
"Got it / Not sure", quiz-dots stubbed as "mark known". That proves the lane shape,
the ordering, and the dot UX with **zero LLM dependency**, and everything after
(M3 quiz loop, M4 remediation) layers onto the same `Step[]` spine.

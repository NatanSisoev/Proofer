# Proofer — Vision

## The thesis

> **Stop building a map of mathematics. Build the tutor that builds a map of _you_ —
> and use mathematics, the one domain where a machine can verify both the content
> and the student's understanding, as the place to prove it.**

The knowledge graph is not the product. It is the **skeleton**. The product is an AI
tutor that genuinely models an individual student's mind, grounded in a verified
structure of mathematics, that refuses to let you fool yourself about what you understand.

Almost everything a "math knowledge graph" does, ChatGPT already does (explain a
concept, list prerequisites, generate a learning path). The only defensible question is
**what makes this impossible to replace with a chatbot** — and the answer is:

- A chatbot is **stateless about you**. The only thing that holds a model of your mind is
  a human tutor — which is why tutoring works and costs $60–100/hr.
- A chatbot's instinct is to **complete the answer**. Learning requires the opposite:
  withholding it and making you produce it (desirable difficulty).

## Three pillars (each independently defensible)

1. **A real mastery model, not self-report.** Inferred per-concept mastery via Bayesian
   Knowledge Tracing over the dependency graph — driven by your performance on problems,
   not a "I know this" button. (Proven by ALEKS: millions of paying users on exactly this,
   but pre-LLM, closed, and shallow.)
2. **Diagnosis, not delivery.** When you fail, the graph lets us trace the error to the
   specific *prerequisite* you're missing and test that — the most tutor-like behavior, and
   only computable because the typed dependency structure exists.
3. **Proof of understanding via generation.** You state it / prove it / give a counterexample;
   the LLM grades the free-form answer against the formal statement and finds the exact gap.
   **This was impossible before ~2024** — it is the unlock that makes the whole thing buildable.

## Why math is the right beachhead

- **Cleanest dependencies** — you genuinely cannot do X without Y, so error-attribution works.
- **Checkable** — answers verify, and proofs can eventually be checked by **Lean/Mathlib**, so
  the tutor can be grounded and non-hallucinating *about math* in a way a general chatbot is not.
- **Universally required and painful** — every STEM student, every semester → recurring revenue.

Expand to physics / CS / econ later (they share the structure). Win math first.

## The moat (3-year)

Not "definitions and theorems" — an LLM has those. The moat is **proprietary learning
dynamics**: at scale, every interaction records *which misconception precedes which error,
which explanation fixes which gap*. That **misconception graph**, layered on the concept
graph, is impossible for a stateless model to own and compounds with every user — the
network effect. ALEKS has a crude, hand-built version; an AI-native one at scale is unprecedented.

## Positioning

| Tool | Nails | Still leaves you suffering |
|---|---|---|
| Anki | retention | you author every card; tests recall not understanding; no dependencies |
| ChatGPT | explanation | stateless about you; does the work *for* you; hallucinates proofs |
| ALEKS | adaptive mastery | ugly, closed, shallow, not AI-native |
| Khan/Brilliant | structure, polish | fixed curriculum ≠ your professor's; not personalized to your gaps |

One-liner for a serious student: *"Anki, except it writes its own cards from your actual
course, tests whether you truly understand, and always knows what you're ready to learn next."*

## Where we are (shipped)

The original "Now" slice is done, and most of what was scoped as Phase 2 shipped with it.
The full assessment loop runs end-to-end on a real 767-concept vault:

- **The tutor loop is live.** Generate a targeted problem → grade the free-form answer → name
  the gap → attribute it to a prerequisite → **BKT** update → frontier recompute. Socratic
  hints that withhold the answer, follow-ups, reveal-on-demand, and per-attempt logging
  (`attempts.gap` / `blamed_prereq`) are all in.
- **Inferred mastery, not self-report.** Continuous BKT with prerequisite propagation; a
  blamed prereq is nudged down, demonstrated use nudges prereqs up. Mastery history,
  sparklines, velocity, and milestones are tracked.
- **Retention scheduling.** Per-concept half-life that doubles on success / halves on failure,
  a "due today" queue, and a review forecast — the FSRS-style spaced-repetition layer is
  working (if hand-rolled).
- **Diagnosis surfaces.** `learningPath()` (known→target shortest path), `recurringWeakPrerequisites`,
  per-node "last gap identified," weak-spot and frontier session modes.
- **AI edge-typing with an approval queue.** `classifyEdge` upgrades untyped `related` edges
  into `depends_on`/`generalizes`/… with confidence, gated behind `/quality`.
- **Product surface around the loop:** Browse / Map / Practice / Progress / History / Plan /
  Quality, plus exam mode (timed), voice answer input, Anki export, bookmarks, personal notes,
  daily goals, an activity calendar, compare-concepts, and an AI study-plan generator. Three
  LLM tiers (Gemini free → Anthropic → demo stub) with caching.

**The 3-month falsifiable test still stands and is now runnable:** *does this beat "Anki +
ChatGPT" for one real course?* Everything below is about making the answer an emphatic yes.

## Where it falls short today (the honest gaps)

These are the load-bearing parts of the thesis that are **not yet real** — and they're exactly
the parts a chatbot can't copy, so they're where the next level lives:

1. **Grading still trusts an LLM about math.** The thesis is "the one domain where a machine can
   *verify*" — but proof-grading is a language model's opinion. It can bless a wrong proof. The
   verification layer (Pillar 3's endgame) does not exist yet.
2. **The misconception graph is single-user and passive.** We *log* gaps; we don't *cluster*
   them, don't predict the next error, and there's no second user — so the network-effect moat
   is a schema, not a system.
3. **The graph is one hand-built vault.** "Your professor's actual course" is still aspirational:
   there's no ingestion path, and discovery is keyword `LIKE` search with no embeddings.
4. **Problem selection is greedy, not optimal.** We pick the lowest-mastery frontier node. We
   don't choose the problem that *most reduces uncertainty about your mind* or that targets your
   specific recorded misconception — and we never ask you to bet on yourself.

## The next level (ambitious bets, in thesis-priority order)

Each bet is here because it deepens a pillar a chatbot structurally cannot reach. None is a
cosmetic feature.

### 1. Formal verification — make grading non-hallucinating (Pillar 3, the endgame)
Wire **Lean 4 / Mathlib** into the loop. For concepts that formalize cleanly, autoformalize the
generated problem's statement, and when the student writes a proof, attempt to elaborate their
argument (or an LLM transcription of it) against the kernel. A *checked* proof is ground truth no
chatbot can offer; a failed elaboration localizes the exact unjustified step, which becomes a
far sharper `blamed_prereq` than an LLM's guess. Start narrow (algebraic identities, basic
analysis/number-theory statements where autoformalization is tractable), degrade gracefully to
LLM grading elsewhere, and **label every verdict with its trust level** (kernel-checked vs.
model-judged). This is the single change that turns "an AI tutor" into "an AI tutor that cannot
be wrong about the math it verifies."

### 2. The misconception graph, for real — the compounding moat (Pillar 2 + the 3-year moat)
Turn the attempt log into a living layer over the concept graph. Cluster `gap`/`blamed_prereq`
text into **named misconceptions** (embedding + LLM labeling), attach them as typed nodes to the
concepts they corrupt, and learn the **transitions**: *which misconception precedes which error*.
Then make it *predictive* — when your attempt pattern matches a known misconception cluster,
pre-empt the next stumble instead of waiting for it ("you're treating `closure` as `interior`;
here's the problem that separates them"). This requires a real **multi-user** substrate so the
graph compounds across students — the network effect the vision promises, made into a system
rather than a single-row table.

### 3. Bring-your-own-course ingestion — the distribution wedge (Pillar 1 at scale)
Let a student drop in a **syllabus, lecture notes, or a problem set (PDF/markdown)** and map it
onto the universal graph: extract concepts, **embed and align** them to existing nodes (dedup vs.
create), propose new nodes and typed edges through the existing approval queue, and tag the
result as *their course*. This is the wedge — "Anki that writes its own cards from *your actual
course*" only becomes literally true when the course is theirs, not one curated vault. It also
feeds the cold-start problem: every uploaded course enriches the shared graph (with provenance).

### 4. Information-theoretic practice + calibration — attack self-deception directly (Pillar 1)
Two upgrades to the selection policy, both squarely on the "refuses to let you fool yourself"
thesis:
- **Optimal-difficulty selection.** Instead of greedily picking the lowest-mastery node, pick the
  problem whose outcome most reduces uncertainty in the mastery model (expected information gain),
  and tune generated difficulty toward the **~85% success band** where learning is fastest
  (desirable difficulty, not demoralization).
- **Calibration as a first-class signal.** Before each answer, ask the student to predict their
  own correctness; score the gap (a running **Brier score**) and surface it. Overconfidence on a
  concept is itself a diagnosis — and measuring it is something no stateless chatbot does, because
  it requires a persistent model of *you*.

### Infra unlock (enables 2–4)
Several bets need the same substrate that Phase 3 always implied: **Postgres + `pgvector`** as the
primary store, embeddings over statements/attempts, and real **multi-user** accounts. All current
SQL is standard and the recursive prerequisite CTE is the only non-trivial query, so the port is
mechanical — do it once, and ingestion-alignment, misconception clustering, and semantic discovery
all fall out of the same vector index.

## Business

Freemium. Free = graph exploration + basic explanations (the marketing surface). Paid
(~$12–20/mo student) = the mastery model, diagnosis, unlimited tutoring, **verified**
proof-grading, exam-prep mode, and bring-your-own-course. Wedge: exam-prep and homework-rescue —
acute, recurring pain. The verification layer (bet #1) and the misconception graph (bet #2) are
what justify a subscription over a $20 chatbot: one is *correct* where the chatbot guesses, the
other *knows you* where the chatbot forgets.

## Honest risks

A tutor wrong about math is fatal — today grading is LLM-only, so **bet #1 (formal verification)
is the highest-leverage de-risking move**, not a far-future nice-to-have. Autoformalization is
hard and won't cover everything (→ narrow beachhead + graceful LLM fallback + explicit trust
labels). Cold-start content is huge (→ course ingestion + AI generation + the shared graph).
Desirable difficulty is unpleasant (→ habit design: streaks, the graph lighting up, exam urgency,
and the ~85% success band so practice feels winnable). The misconception moat only compounds with
users (→ ingestion is the acquisition wedge that gets us to multi-user critical mass). BKT is hard
but known science (ALEKS/Carnegie proved it).

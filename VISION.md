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

## Roadmap

- **Now (this repo):** typed graph imported from a real vault; cycle-safe prerequisite
  closure; **mastery model + generative assessment loop** (generate problem → grade free-form
  answer → BKT update → frontier). The 3-month falsifiable test: *does this beat "Anki + ChatGPT"
  for one real course?*
- **Phase 2:** upload-your-course (syllabus/notes/problem sets) → map onto the universal graph;
  AI edge-typing with an approval queue; FSRS retention scheduling; learning-path generation.
- **Phase 3:** the misconception dataset; Lean/Mathlib verification of statements and proofs;
  semantic search (pgvector); Postgres as the primary store; public contribution with provenance.

## Business

Freemium. Free = graph exploration + basic explanations (the marketing surface). Paid
(~$12–20/mo student) = the mastery model, diagnosis, unlimited tutoring, proof-grading,
exam-prep mode, upload-your-course. Wedge: exam-prep and homework-rescue — acute, recurring pain.

## Honest risks

A tutor wrong about math is fatal (→ verification layer, formal backing). Cold-start content
is huge (→ AI generation + your vault + formal verification for quality). Desirable difficulty
is unpleasant (→ habit design: streaks, the graph lighting up, exam urgency). BKT is hard but
known science (ALEKS/Carnegie proved it).

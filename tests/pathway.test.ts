import { test } from "node:test";
import assert from "node:assert/strict";
import { unitSteps, quizKindsFor, selectDetourPrereqs } from "../lib/pathway.ts";

const blamed = (over: Partial<{ prereq: string; blame_count: number; exists_: number; mastery_p: number }>) => ({
  prereq: "P", blame_count: 2, exists_: 1, mastery_p: 0.3, ...over,
});

test("selectDetourPrereqs: keeps a blamed, unmastered, existing prerequisite (a gap)", () => {
  const out = selectDetourPrereqs([blamed({ prereq: "Limits", mastery_p: 0.2, blame_count: 3 })], "Continuity");
  assert.deepEqual(out, [{ id: "Limits", blameCount: 3, masteryP: 0.2 }]);
});

test("selectDetourPrereqs: KEEPS a blamed but mastered prerequisite (a blind spot)", () => {
  // The whole point: the current unit's direct prereqs are already mastered, so
  // a strict unmastered filter would leave this empty. A high-mastery, repeatedly
  // blamed prereq is a blind spot worth surfacing — carry its mastery through.
  assert.deepEqual(selectDetourPrereqs([blamed({ prereq: "Sets", mastery_p: 0.95 })], "Continuity"), [
    { id: "Sets", blameCount: 2, masteryP: 0.95 },
  ]);
});

test("selectDetourPrereqs: drops a ghost prerequisite (no note to practice from)", () => {
  assert.deepEqual(selectDetourPrereqs([blamed({ exists_: 0 })], "Continuity"), []);
});

test("selectDetourPrereqs: never routes a unit to itself", () => {
  assert.deepEqual(selectDetourPrereqs([blamed({ prereq: "Continuity" })], "Continuity"), []);
});

test("selectDetourPrereqs: keeps every real, non-self blamed prereq from a mixed list", () => {
  const out = selectDetourPrereqs(
    [
      blamed({ prereq: "Limits", mastery_p: 0.1 }),      // gap → keep
      blamed({ prereq: "Sets", mastery_p: 0.95 }),        // blind spot → keep
      blamed({ prereq: "Ghost", exists_: 0 }),            // ghost → drop
      blamed({ prereq: "Continuity" }),                   // self → drop
    ],
    "Continuity"
  );
  assert.deepEqual(out.map((d) => d.id), ["Limits", "Sets"]);
});

test("quizKindsFor: theorem-like types get a prove dot, others get compute", () => {
  assert.deepEqual(quizKindsFor("Theorem"), ["explain", "prove"]);
  assert.deepEqual(quizKindsFor("Lemma"), ["explain", "prove"]);
  assert.deepEqual(quizKindsFor("Definition"), ["explain", "compute"]);
  assert.deepEqual(quizKindsFor(null), ["explain", "compute"]);
});

test("unitSteps: leads with Intuition over Statement when both exist", () => {
  const node = {
    type: "Definition",
    overview: "A short overview.",
    content: "## Statement\nThe formal statement.\n\n## Intuition\nThe intuitive idea.",
  };
  const steps = unitSteps(node);
  assert.equal(steps[0].kind, "read");
  assert.equal((steps[0] as any).section, "Intuition");
  assert.equal(steps[1].kind, "read");
  assert.equal((steps[1] as any).section, "Statement");
});

test("unitSteps: falls back to the overview field when the note has no matching sections", () => {
  const node = { type: "Definition", overview: "A short overview.", content: "## Connections\n- [[Something]]" };
  const steps = unitSteps(node);
  assert.equal(steps[0].kind, "read");
  assert.equal((steps[0] as any).content, "A short overview.");
});

test("unitSteps: always ends with quiz dots matching the concept type", () => {
  const node = { type: "Theorem", overview: null, content: "## Statement\nSome theorem." };
  const steps = unitSteps(node);
  const quizSteps = steps.filter((s) => s.kind === "quiz");
  assert.deepEqual(quizSteps.map((s: any) => s.problemKind), ["explain", "prove"]);
});

test("unitSteps: never duplicates a section that's both the intro and Statement", () => {
  const node = { type: "Definition", overview: null, content: "## Overview\nThe intro doubles as overview." };
  const steps = unitSteps(node);
  const readSteps = steps.filter((s) => s.kind === "read");
  assert.equal(readSteps.length, 1);
});

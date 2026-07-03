import { test } from "node:test";
import assert from "node:assert/strict";
import { unitSteps, quizKindsFor } from "../lib/pathway.ts";

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

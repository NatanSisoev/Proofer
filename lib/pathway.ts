// Learning Pathways — phase 1 (see LEARNING_PATHWAYS.md). Turns the static
// learningPath() prerequisite list into an ordered lane of "dots": read-dots
// sourced straight from the note's own sections (never LLM-authored — a
// tutor wrong about math is fatal) and quiz-dots that hand off to the
// existing generate/grade/BKT loop via /learn. No new table: the lane is
// derived live from current mastery on every call, so it self-updates as
// the student practices elsewhere.
import { MASTERY_THRESHOLD } from "./db";
import { getNode, learningPath, type BrowseNode } from "./queries";
import { getMasteryP } from "./mastery";
import { splitSections } from "./sections";
import type { ProblemKind } from "./llm";

export type PathwayStep =
  | { kind: "read"; section: string; content: string }
  | { kind: "quiz"; problemKind: ProblemKind };

export type PathwayUnit = {
  id: string;
  title: string;
  type: string | null;
  masteryP: number;
  gated: boolean; // hasn't cleared MASTERY_THRESHOLD yet
  steps: PathwayStep[];
};

export type Pathway = {
  targetId: string;
  targetTitle: string;
  units: PathwayUnit[]; // ordered furthest-prerequisite-first; the target is always last
  // Index of the first gated unit — the one the student is actively working
  // on; everything after it is locked, everything before it is done. -1
  // means every unit (including the target) already cleared the gate.
  currentIndex: number;
};

// Preferred read-dot ordering: lead with whichever intuition-style section
// exists, then the formal Statement (skip it if it was already the intro).
const INTRO_SECTIONS = ["Intuition", "Motivation", "Overview"];

export function quizKindsFor(type: string | null): ProblemKind[] {
  const provesTheorem = type === "Theorem" || type === "Lemma" || type === "Corollary" || type === "Proposition";
  return provesTheorem ? ["explain", "prove"] : ["explain", "compute"];
}

/** Pure — no DB access — so this is unit-testable directly. */
export function unitSteps(node: { type: string | null; overview: string | null; content: string | null }): PathwayStep[] {
  const steps: PathwayStep[] = [];
  const sections = splitSections(node.content || "");
  const byName = new Map(sections.map((s) => [s.name, s.text]));

  const intro = INTRO_SECTIONS.find((n) => byName.has(n));
  if (intro) steps.push({ kind: "read", section: intro, content: byName.get(intro)! });
  if (byName.has("Statement") && intro !== "Statement") {
    steps.push({ kind: "read", section: "Statement", content: byName.get("Statement")! });
  }
  if (steps.length === 0 && node.overview) {
    steps.push({ kind: "read", section: "Overview", content: node.overview });
  }

  for (const k of quizKindsFor(node.type)) {
    steps.push({ kind: "quiz", problemKind: k });
  }
  return steps;
}

function unitFromBrowseNode(n: BrowseNode): PathwayUnit {
  return { id: n.id, title: n.title, type: n.type, masteryP: n.mastery_p, gated: n.mastery_p < MASTERY_THRESHOLD, steps: unitSteps(n) };
}

/**
 * Build the guided lane toward `targetId`: every unmastered prerequisite in
 * dependency order (furthest foundation first, reusing learningPath()'s
 * topological depth sort), then the target itself as the final unit.
 * Returns null if the target doesn't exist.
 */
export function pathway(targetId: string): Pathway | null {
  const target = getNode(targetId);
  if (!target || !target.exists_) return null;

  const prereqUnits = learningPath(targetId).map(unitFromBrowseNode);
  const targetMasteryP = getMasteryP(target.id);
  const targetUnit: PathwayUnit = {
    id: target.id,
    title: target.title,
    type: target.type,
    masteryP: targetMasteryP,
    gated: targetMasteryP < MASTERY_THRESHOLD,
    steps: unitSteps(target),
  };

  const units = [...prereqUnits, targetUnit];
  const currentIndex = units.findIndex((u) => u.gated);

  return { targetId, targetTitle: target.title, units, currentIndex };
}

// Learning Pathways — phase 1 (see LEARNING_PATHWAYS.md). Turns the static
// learningPath() prerequisite list into an ordered lane of "dots": read-dots
// sourced straight from the note's own sections (never LLM-authored — a
// tutor wrong about math is fatal) and quiz-dots that hand off to the
// existing generate/grade/BKT loop via /learn. No new table: the lane is
// derived live from current mastery on every call, so it self-updates as
// the student practices elsewhere.
import { MASTERY_THRESHOLD } from "./db";
import { getNode, learningPath, nodeBlamedPrereqs, type BrowseNode } from "./queries";
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
  // Prerequisite with no note yet (exists_ = 0). Shown as an explicit gap in
  // the lane — there's nothing to read and nothing to grade against, so it
  // never gates progression and has no steps; the row links to the node page
  // where the ghost can be written (GhostCreate).
  ghost: boolean;
  steps: PathwayStep[];
};

// A prerequisite the grader keeps blaming on the unit you're currently stuck on
// (M4 "adaptive remediation detour"). Surfaced as a marked detour on the current
// unit rather than a spine re-shuffle — the design's own risk note is "remediation
// as marked detours, not a re-shuffle" (stable spine keeps the path feeling like
// a path). Routes you to shore the foundation up, then you return to the unit.
export type DetourPrereq = { id: string; title: string; type: string | null; masteryP: number; blameCount: number };

export type Pathway = {
  targetId: string;
  targetTitle: string;
  units: PathwayUnit[]; // ordered furthest-prerequisite-first; the target is always last
  // Index of the first gated unit — the one the student is actively working
  // on; everything after it is locked, everything before it is done. -1
  // means every unit (including the target) already cleared the gate.
  currentIndex: number;
  // Blamed, still-unmastered prerequisites of the current unit — the diagnosed
  // reason recent attempts on it failed. Empty until you've actually missed on it.
  detour: DetourPrereq[];
};

/**
 * Pure selector for the current unit's remediation detour: of the prerequisites
 * the grader blamed on it, keep the ones that (a) have a note to practice from
 * and (b) aren't the unit itself. Pure so the rule is unit-testable without a DB.
 *
 * Note the deliberate absence of an "unmastered prerequisite" filter, which the
 * original M4 spec called for. The current unit is the first *gated* unit, so
 * its direct prerequisites (the only ones the grader ever blames) are already
 * above the mastery threshold — a strict unmastered filter would leave this
 * empty for every normally-progressed lane. A blamed-but-mastered prerequisite
 * is exactly the useful case: a blind spot the model thinks you've got but your
 * misses keep tracing to. The caller carries `mastery_p` through so the UI can
 * frame each detour as a gap (low mastery) or a blind spot (high mastery).
 */
export function selectDetourPrereqs(
  blamed: { prereq: string; blame_count: number; exists_: number; mastery_p: number }[],
  currentUnitId: string
): { id: string; blameCount: number; masteryP: number }[] {
  return blamed
    .filter((b) => b.exists_ === 1 && b.prereq !== currentUnitId)
    .map((b) => ({ id: b.prereq, blameCount: b.blame_count, masteryP: b.mastery_p }));
}

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
  const ghost = !n.exists_;
  return {
    id: n.id,
    title: n.title,
    type: n.type,
    masteryP: n.mastery_p,
    ghost,
    gated: !ghost && n.mastery_p < MASTERY_THRESHOLD,
    steps: ghost ? [] : unitSteps(n),
  };
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
    ghost: false,
    gated: targetMasteryP < MASTERY_THRESHOLD,
    steps: unitSteps(target),
  };

  const units = [...prereqUnits, targetUnit];
  const currentIndex = units.findIndex((u) => u.gated);

  // M4 remediation detour. The diagnostic signal (blamed prerequisites) lives on
  // the concepts the student has actually practiced and missed — overwhelmingly
  // the target itself, not the deepest still-locked foundation the lane happens
  // to make "current". So the detour reads the *target's* blame history: the
  // prerequisites its failures keep tracing to, which are exactly the
  // foundations to shore up on the way down. Only meaningful while the lane is
  // still in progress. See selectDetourPrereqs for the mastered-is-a-blind-spot
  // reasoning.
  let detour: DetourPrereq[] = [];
  if (currentIndex >= 0) {
    detour = selectDetourPrereqs(nodeBlamedPrereqs(target.id, 3), target.id).map((d) => {
      const n = getNode(d.id);
      return { id: d.id, title: n?.title ?? d.id, type: n?.type ?? null, masteryP: d.masteryP, blameCount: d.blameCount };
    });
  }

  return { targetId, targetTitle: target.title, units, currentIndex, detour };
}

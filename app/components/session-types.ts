import type { Problem, Grade, ProblemNode } from "./ProblemCard";

// A queued concept. `reason` (e.g. "near your edge", "due for review") explains
// why the selection policy chose it; `reasonDetail` is a longer explanation for
// the reason-tag tooltip (e.g. "you rate this 30pp above your results"), set
// only where the selection policy has something specific to say. `mastery_p`
// is its current mastery. All three are attached by /api/session/queue and
// are optional for hand-built queues.
export type QueueNode = ProblemNode & { reason?: string; reasonDetail?: string; mastery_p?: number };

export type SessionResult = {
  node: QueueNode;
  verdict: "correct" | "partial" | "incorrect";
  masteryBefore: number;
  masteryAfter: number;
  justMastered?: boolean;
  elapsedSec?: number;
  predicted?: number; // pre-answer confidence (0..1), when calibration is enabled
};

// Per-card snapshot for back-navigation and persistence
export type CardState = {
  problem: Problem | null;
  answer: string;
  grade: Grade | null;
  revealed: string | null;
  hint: string | null;
};

export type SavedSession = {
  activeQueue: QueueNode[];
  index: number;
  preferKind?: string;
  resultsByIndex: Record<number, SessionResult>;
  cardStates: Record<number, CardState>;
};

export const SESSION_KEY = "proofer-session";

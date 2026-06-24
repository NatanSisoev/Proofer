import type { Problem, Grade, ProblemNode } from "./ProblemCard";

// A queued concept. `reason` (e.g. "near your edge", "due for review") explains
// why the selection policy chose it; `mastery_p` is its current mastery. Both
// are attached by /api/session/queue and are optional for hand-built queues.
export type QueueNode = ProblemNode & { reason?: string; mastery_p?: number };

export type SessionResult = {
  node: QueueNode;
  verdict: "correct" | "partial" | "incorrect";
  masteryBefore: number;
  masteryAfter: number;
  justMastered?: boolean;
  elapsedSec?: number;
};

// Per-card snapshot for back-navigation and persistence
export type CardState = {
  problem: Problem | null;
  answer: string;
  grade: Grade | null;
  revealed: string | null;
  hint: string | null;
  followUp: string;
};

export type SavedSession = {
  activeQueue: QueueNode[];
  index: number;
  preferKind?: string;
  resultsByIndex: Record<number, SessionResult>;
  cardStates: Record<number, CardState>;
};

export const SESSION_KEY = "proofer-session";

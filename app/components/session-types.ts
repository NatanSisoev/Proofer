import type { Problem, Grade, ProblemNode } from "./ProblemCard";

export type QueueNode = ProblemNode;

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

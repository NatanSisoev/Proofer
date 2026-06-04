import Anthropic from "@anthropic-ai/sdk";
import type { NodeRow } from "./db";

// Default to the most capable model for BOTH tasks. Grading a free-form proof is
// the most intelligence-sensitive thing this app does, so we do not downgrade.
// (You can drop PROBLEM_MODEL to "claude-sonnet-4-6" later to cut cost on gen.)
const PROBLEM_MODEL = "claude-opus-4-8";
const GRADE_MODEL = "claude-opus-4-8";

export const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;
const client = HAS_KEY ? new Anthropic() : null;

/** Turn an SDK/API error into a user-facing { status, message } the UI can show. */
export function friendlyLLMError(e: unknown): { status: number; message: string } {
  if (e instanceof Anthropic.APIError) {
    const raw = (e as any)?.error?.error?.message || e.message || "API error";
    if (e.status === 400 && /credit balance/i.test(raw))
      return {
        status: 402,
        message:
          "Your Anthropic API account is out of credits. Add credits at console.anthropic.com → Plans & Billing. (A Claude Pro/Max subscription does NOT fund the API — it's separate, pay-as-you-go billing.)",
      };
    if (e.status === 401)
      return { status: 401, message: "Invalid ANTHROPIC_API_KEY. Check the key in .env.local and restart." };
    if (e.status === 429)
      return { status: 429, message: "Rate limited by the Anthropic API. Wait a moment and try again." };
    return { status: e.status ?? 502, message: raw };
  }
  return { status: 500, message: e instanceof Error ? e.message : "Unexpected error" };
}

export type GeneratedProblem = {
  problem: string;
  kind: "compute" | "prove" | "counterexample" | "explain";
  ideal_solution: string;
  rubric: string[];
  prerequisites_used: string[];
};

export type GradeResult = {
  verdict: "correct" | "partial" | "incorrect";
  mastery_evidence: number; // 0..1
  understood: string[];
  gap: string;
  blamed_prerequisite: string; // one of the supplied prereq ids, or ""
  socratic_hint: string;
};

// ---------------------------------------------------------------------------
// Shared, FROZEN system prompts (cache_control caches them across requests).
// Keep them byte-stable — volatile per-concept content goes in the user turn.
// ---------------------------------------------------------------------------
const AUTHOR_SYSTEM = `You are an expert mathematics problem author embedded in a learning tool.
Given one concept (a definition, theorem, lemma, etc.) and its prerequisites, you write ONE problem that tests genuine UNDERSTANDING of that concept — not recall.
Principles:
- Prefer problems that require the student to STATE, PROVE, apply, or produce a (counter)example, over plug-and-chug computation.
- The problem must genuinely exercise the target concept; it may lean on the listed prerequisites.
- Calibrate difficulty so a student who truly understands the concept can solve it, but someone who only memorized the statement cannot.
- Use LaTeX with $...$ and $$...$$ for mathematics.
- Provide a correct ideal solution and a short rubric of the key points any correct answer must contain.`;

const GRADER_SYSTEM = `You are a rigorous but encouraging mathematics tutor grading a student's free-form answer.
Your job is DIAGNOSIS, not delivery. You must:
- Judge whether the answer demonstrates real understanding of the TARGET concept (verdict: correct | partial | incorrect).
- Identify precisely what the student understood and where the specific gap is — name the exact misconception, not a vague "review this".
- Attribute the gap to ONE prerequisite concept from the provided list when the error traces to a missing prerequisite; otherwise leave it empty.
- Give a Socratic hint that guides without revealing the full solution. NEVER hand them the answer — make them produce it.
- mastery_evidence is your calibrated probability (0..1) that the student has mastered the target concept based on this answer alone.
Be fair: partial credit for partial understanding. Be honest: do not praise a wrong proof.`;

function firstJson<T>(msg: Anthropic.Message): T {
  const block = msg.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("no text block in response");
  return JSON.parse(block.text) as T;
}

// ---------------------------------------------------------------------------
// Problem generation
// ---------------------------------------------------------------------------
const PROBLEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    problem: { type: "string" },
    kind: { type: "string", enum: ["compute", "prove", "counterexample", "explain"] },
    ideal_solution: { type: "string" },
    rubric: { type: "array", items: { type: "string" } },
    prerequisites_used: { type: "array", items: { type: "string" } },
  },
  required: ["problem", "kind", "ideal_solution", "rubric", "prerequisites_used"],
};

export async function generateProblem(node: NodeRow, prereqs: string[]): Promise<GeneratedProblem> {
  if (!client) return stubProblem(node);
  const userText = [
    `TARGET CONCEPT: ${node.title}`,
    node.type ? `Type: ${node.type}` : "",
    node.area ? `Area: ${node.area}` : "",
    node.overview ? `Overview: ${node.overview}` : "",
    node.content ? `\nFull note:\n${node.content.slice(0, 4000)}` : "",
    prereqs.length ? `\nPrerequisites you may use: ${prereqs.join(", ")}` : "",
    `\nWrite one problem that tests genuine understanding of "${node.title}".`,
  ]
    .filter(Boolean)
    .join("\n");

  const msg = await client.messages.create({
    model: PROBLEM_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: { type: "json_schema", schema: PROBLEM_SCHEMA } },
    system: [{ type: "text", text: AUTHOR_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userText }],
  });
  return firstJson<GeneratedProblem>(msg);
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------
function gradeSchema(prereqIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      verdict: { type: "string", enum: ["correct", "partial", "incorrect"] },
      mastery_evidence: { type: "number" },
      understood: { type: "array", items: { type: "string" } },
      gap: { type: "string" },
      blamed_prerequisite: { type: "string", enum: [...prereqIds, ""] },
      socratic_hint: { type: "string" },
    },
    required: ["verdict", "mastery_evidence", "understood", "gap", "blamed_prerequisite", "socratic_hint"],
  };
}

export async function gradeAnswer(args: {
  node: NodeRow;
  problem: string;
  idealSolution: string;
  rubric: string[];
  answer: string;
  prereqs: string[];
}): Promise<GradeResult> {
  if (!client) return stubGrade(args.answer);
  const userText = [
    `TARGET CONCEPT: ${args.node.title}` + (args.node.type ? ` (${args.node.type})` : ""),
    args.node.overview ? `Overview: ${args.node.overview}` : "",
    `\nPROBLEM:\n${args.problem}`,
    `\nIDEAL SOLUTION (reference, do not reveal):\n${args.idealSolution}`,
    args.rubric.length ? `\nRUBRIC:\n- ${args.rubric.join("\n- ")}` : "",
    args.prereqs.length ? `\nPREREQUISITES (attribute a gap to one of these exact names, or ""): ${args.prereqs.join(", ")}` : "",
    `\nSTUDENT ANSWER:\n${args.answer || "(blank)"}`,
    `\nGrade it.`,
  ]
    .filter(Boolean)
    .join("\n");

  const msg = await client.messages.create({
    model: GRADE_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: { type: "json_schema", schema: gradeSchema(args.prereqs) } },
    system: [{ type: "text", text: GRADER_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userText }],
  });
  const r = firstJson<GradeResult>(msg);
  r.mastery_evidence = Math.max(0, Math.min(1, r.mastery_evidence));
  return r;
}

// ---------------------------------------------------------------------------
// Stub fallback (no API key) — keeps the loop runnable; clearly marked "demo".
// ---------------------------------------------------------------------------
function stubProblem(node: NodeRow): GeneratedProblem {
  const verb =
    node.type === "Definition"
      ? `State the definition of **${node.title}** precisely, then give one example and one non-example, justifying each.`
      : `State **${node.title}** precisely and sketch why it holds (or give the key idea of its proof).`;
  return {
    problem: `${verb}\n\n_(Demo problem — set ANTHROPIC_API_KEY for AI-authored problems.)_`,
    kind: node.type === "Definition" ? "explain" : "prove",
    ideal_solution: node.content?.slice(0, 1200) || node.overview || "",
    rubric: ["States the concept correctly", "Justifies with a correct example or argument"],
    prerequisites_used: [],
  };
}

function stubGrade(answer: string): GradeResult {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const evidence = Math.max(0.1, Math.min(0.85, words / 60));
  return {
    verdict: words > 40 ? "partial" : words > 8 ? "partial" : "incorrect",
    mastery_evidence: evidence,
    understood: words > 8 ? ["You attempted an explanation."] : [],
    gap: "Demo mode: real diagnosis needs an API key. This placeholder scores by answer length only.",
    blamed_prerequisite: "",
    socratic_hint: "Set ANTHROPIC_API_KEY to get a real Socratic hint that pinpoints your specific gap.",
  };
}

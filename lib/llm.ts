import Anthropic from "@anthropic-ai/sdk";
import type { NodeRow } from "./db";

// Provider selection: Gemini (free tier) wins if its key is set; else Anthropic;
// else a demo stub. The LLM layer is the only provider-aware part of the app.
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
export const PROVIDER: "gemini" | "anthropic" | "none" = GEMINI_KEY ? "gemini" : ANTHROPIC_KEY ? "anthropic" : "none";
export const HAS_KEY = PROVIDER !== "none";

// Models. Gemini 2.5 Flash has free-tier quota (2.0-flash is limit:0 in some
// regions, e.g. the EU) and is stronger at math reasoning.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ANTHROPIC_PROBLEM_MODEL = "claude-opus-4-8";
const ANTHROPIC_GRADE_MODEL = "claude-opus-4-8";

const anthropic = ANTHROPIC_KEY ? new Anthropic() : null;

export type ProviderInfo = {
  provider: "gemini" | "anthropic" | "none";
  label: string;       // human-readable provider name
  model: string | null; // active model id, or null in demo mode
  hasKey: boolean;
};

/** The currently active LLM provider + model, for surfacing in the UI so users
 *  know which tier (Gemini → Anthropic → demo stub) is answering. */
export function providerInfo(): ProviderInfo {
  if (PROVIDER === "gemini") return { provider: "gemini", label: "Google Gemini", model: GEMINI_MODEL, hasKey: true };
  if (PROVIDER === "anthropic") return { provider: "anthropic", label: "Anthropic Claude", model: ANTHROPIC_PROBLEM_MODEL, hasKey: true };
  return { provider: "none", label: "Demo mode", model: null, hasKey: false };
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
// Shared, FROZEN system prompts.
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
Your job is DIAGNOSIS, not delivery. Address the student directly as "you" — never refer to them in the third person.
You must:
- Judge whether the answer demonstrates real understanding of the TARGET concept (verdict: correct | partial | incorrect).
- Identify precisely what you understood and where your specific gap is — name the exact misconception, not a vague "review this".
- Attribute the gap to ONE prerequisite concept from the provided list when the error traces to a missing prerequisite; otherwise use "none".
- Give a Socratic hint that guides without revealing the full solution. NEVER hand the student the answer — make them produce it.
- mastery_evidence is your calibrated probability (0..1) that the student has mastered the target concept based on this answer alone.
Be fair: partial credit for partial understanding. Be honest: do not praise a wrong proof.`;

export type ProblemKind = "compute" | "prove" | "counterexample" | "explain";

function problemUserText(node: NodeRow, prereqs: string[], recentGaps: string[] = [], preferKind?: ProblemKind): string {
  const kindHint = preferKind
    ? `\nIMPORTANT: Write a "${preferKind}" type problem specifically. The kind field in your JSON MUST be "${preferKind}".`
    : "";
  return [
    `TARGET CONCEPT: ${node.title}`,
    node.type ? `Type: ${node.type}` : "",
    node.area ? `Area: ${node.area}` : "",
    node.overview ? `Overview: ${node.overview}` : "",
    node.content ? `\nFull note:\n${node.content.slice(0, 4000)}` : "",
    prereqs.length ? `\nPrerequisites you may use: ${prereqs.join(", ")}` : "",
    recentGaps.length
      ? `\nThis student has struggled before. Recent gaps in their understanding:\n${recentGaps.map((g, i) => `${i + 1}. ${g}`).join("\n")}\nWrite a problem that DIRECTLY ADDRESSES one of these specific gaps — do not repeat the aspect they already got right.`
      : `\nWrite one problem that tests genuine understanding of "${node.title}".`,
    kindHint,
    `\nRespond as JSON.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function gradeUserText(a: {
  node: NodeRow;
  problem: string;
  idealSolution: string;
  rubric: string[];
  answer: string;
  prereqs: string[];
}): string {
  return [
    `TARGET CONCEPT: ${a.node.title}` + (a.node.type ? ` (${a.node.type})` : ""),
    a.node.overview ? `Overview: ${a.node.overview}` : "",
    `\nPROBLEM:\n${a.problem}`,
    `\nIDEAL SOLUTION (reference, do not reveal):\n${a.idealSolution}`,
    a.rubric.length ? `\nRUBRIC:\n- ${a.rubric.join("\n- ")}` : "",
    a.prereqs.length
      ? `\nPREREQUISITES (set blamed_prerequisite to one of these EXACT names, or "none"): ${a.prereqs.join(", ")}`
      : `\n(There are no prerequisites; set blamed_prerequisite to "none".)`,
    `\nSTUDENT ANSWER:\n${a.answer || "(blank)"}`,
    `\nGrade it. Respond as JSON.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ===========================================================================
// Dispatch
// ===========================================================================
export async function generateProblem(node: NodeRow, prereqs: string[], recentGaps: string[] = [], preferKind?: ProblemKind): Promise<GeneratedProblem> {
  if (PROVIDER === "gemini") return geminiGenerate(node, prereqs, recentGaps, preferKind);
  if (PROVIDER === "anthropic") return anthropicGenerate(node, prereqs, recentGaps, preferKind);
  return stubProblem(node);
}

export async function gradeAnswer(args: {
  node: NodeRow;
  problem: string;
  idealSolution: string;
  rubric: string[];
  answer: string;
  prereqs: string[];
}): Promise<GradeResult> {
  let r: GradeResult;
  if (PROVIDER === "gemini") r = await geminiGrade(args);
  else if (PROVIDER === "anthropic") r = await anthropicGrade(args);
  else r = stubGrade(args.answer);
  if (r.blamed_prerequisite === "none") r.blamed_prerequisite = "";
  r.mastery_evidence = Math.max(0, Math.min(1, r.mastery_evidence));
  return r;
}

export async function explainConcept(
  node: import("./db").NodeRow,
  prereqs: string[]
): Promise<string> {
  if (PROVIDER === "none") return "";
  const prompt = [
    `Explain the concept "${node.title}" to a student who already knows: ${prereqs.join(", ") || "the basics"}.`,
    node.type ? `This is a ${node.type}.` : "",
    node.area ? `Area: ${node.area}.` : "",
    node.overview ? `Overview: ${node.overview}` : "",
    node.content ? `\nFull definition/statement:\n${node.content.slice(0, 3000)}` : "",
    `\nWrite a clear, intuitive explanation in 3–5 paragraphs. Use concrete examples and analogies. Use LaTeX ($...$) for any mathematics. Address the student as "you". Focus on WHY this matters, not just what it says.`,
  ]
    .filter(Boolean)
    .join("\n");

  if (PROVIDER === "gemini") {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1800, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  }

  if (PROVIDER === "anthropic" && anthropic) {
    const msg = await anthropic.messages.create({
      model: ANTHROPIC_GRADE_MODEL,
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });
    return (msg.content[0] as any)?.text?.trim() ?? "";
  }

  return "";
}

const HINT_SCHEMA_G = {
  type: "OBJECT",
  properties: { hint: { type: "STRING" } },
  required: ["hint"],
  propertyOrdering: ["hint"],
};

/**
 * Generate a Socratic pre-submission hint for a specific problem.
 * Returns 1–2 sentences nudging the student in the right direction
 * WITHOUT revealing the answer. Much lighter than a full explanation.
 */
export async function generateHint(args: {
  problem: string;
  nodeTitle: string;
  nodeType: string | null;
  idealSolution: string;
}): Promise<string> {
  if (PROVIDER === "none") return "No AI provider configured — set GEMINI_API_KEY for hints.";
  const prompt = [
    `A student is about to solve this problem:`,
    `\nCONCEPT: ${args.nodeTitle}${args.nodeType ? ` (${args.nodeType})` : ""}`,
    `\nPROBLEM:\n${args.problem}`,
    `\nIDEAL SOLUTION (for reference, do NOT reveal):\n${args.idealSolution.slice(0, 800)}`,
    `\nWrite ONE Socratic hint — 1–2 sentences. Ask a guiding question or point to the key idea WITHOUT giving the answer or solution steps. Make it specific to this problem.`,
    `\nRespond as JSON with a single "hint" field.`,
  ]
    .filter(Boolean)
    .join("\n");

  if (PROVIDER === "gemini") {
    const result = await geminiCall(
      "You are a Socratic math tutor. Give hints that guide, never answers that reveal.",
      prompt,
      HINT_SCHEMA_G,
      0.6
    );
    return result.hint as string;
  }

  if (PROVIDER === "anthropic" && anthropic) {
    const msg = await anthropic.messages.create({
      model: ANTHROPIC_GRADE_MODEL,
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    return (msg.content[0] as any)?.text?.trim() ?? "";
  }

  return "";
}

export async function diagnoseWeakness(
  nodeTitle: string,
  gaps: string[],
  blamedPrereqs: string[]
): Promise<string> {
  if (PROVIDER === "none") return "";
  const uniq = (arr: string[]) => [...new Set(arr.filter(Boolean))];
  const prompt = [
    `A student has attempted the concept "${nodeTitle}" ${gaps.length} time(s) without mastering it.`,
    `Here are the specific gaps identified in each attempt:`,
    gaps.map((g, i) => `${i + 1}. ${g}`).join("\n"),
    blamedPrereqs.length
      ? `Prerequisite concepts they keep struggling with: ${uniq(blamedPrereqs).join(", ")}`
      : "",
    `In 2–4 sentences, diagnose the ROOT CAUSE of their persistent struggle with "${nodeTitle}". ` +
    `Be specific — name the exact misconception or missing foundation. ` +
    `End with one targeted advice sentence. Address the student as "you".`,
  ]
    .filter(Boolean)
    .join("\n");

  if (PROVIDER === "gemini") {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 600, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    if (!resp.ok) return "";
    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  }

  if (PROVIDER === "anthropic" && anthropic) {
    const msg = await anthropic.messages.create({
      model: ANTHROPIC_GRADE_MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
    return (msg.content[0] as any)?.text?.trim() ?? "";
  }

  return "";
}

// ===========================================================================
// Gemini (free tier) — REST, structured JSON output
// ===========================================================================
class ProviderError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const G_PROBLEM_SCHEMA = {
  type: "OBJECT",
  properties: {
    problem: { type: "STRING" },
    kind: { type: "STRING", enum: ["compute", "prove", "counterexample", "explain"] },
    ideal_solution: { type: "STRING" },
    rubric: { type: "ARRAY", items: { type: "STRING" } },
    prerequisites_used: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["problem", "kind", "ideal_solution", "rubric", "prerequisites_used"],
  propertyOrdering: ["problem", "kind", "ideal_solution", "rubric", "prerequisites_used"],
};

function gGradeSchema(prereqs: string[]) {
  return {
    type: "OBJECT",
    properties: {
      verdict: { type: "STRING", enum: ["correct", "partial", "incorrect"] },
      mastery_evidence: { type: "NUMBER" },
      understood: { type: "ARRAY", items: { type: "STRING" } },
      gap: { type: "STRING" },
      blamed_prerequisite: { type: "STRING", enum: [...prereqs, "none"] },
      socratic_hint: { type: "STRING" },
    },
    required: ["verdict", "mastery_evidence", "understood", "gap", "blamed_prerequisite", "socratic_hint"],
    propertyOrdering: ["verdict", "mastery_evidence", "understood", "gap", "blamed_prerequisite", "socratic_hint"],
  };
}

async function geminiCall(system: string, userText: string, schema: unknown, temperature: number): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: schema,
        // Disable 2.5's dynamic "thinking" for these calls: it would eat into the
        // output budget and can truncate the structured JSON. Ignored by models
        // that don't support thinking.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  const data = await res.json().catch(() => ({}) as any);
  if (!res.ok) throw new ProviderError(res.status, data?.error?.message || `Gemini HTTP ${res.status}`);
  const cand = data?.candidates?.[0];
  const text: string = (cand?.content?.parts || []).map((p: any) => p.text).filter(Boolean).join("");
  if (!text) {
    const reason = cand?.finishReason || data?.promptFeedback?.blockReason || "empty response";
    throw new ProviderError(502, `Gemini returned no content (${reason})`);
  }
  return JSON.parse(text);
}

async function geminiGenerate(node: NodeRow, prereqs: string[], recentGaps: string[] = [], preferKind?: ProblemKind): Promise<GeneratedProblem> {
  return geminiCall(AUTHOR_SYSTEM, problemUserText(node, prereqs, recentGaps, preferKind), G_PROBLEM_SCHEMA, 0.8);
}

async function geminiGrade(a: Parameters<typeof gradeAnswer>[0]): Promise<GradeResult> {
  return geminiCall(GRADER_SYSTEM, gradeUserText(a), gGradeSchema(a.prereqs), 0.2);
}

// ===========================================================================
// Anthropic (kept for when the API is funded)
// ===========================================================================
const A_PROBLEM_SCHEMA = {
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

function aGradeSchema(prereqs: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      verdict: { type: "string", enum: ["correct", "partial", "incorrect"] },
      mastery_evidence: { type: "number" },
      understood: { type: "array", items: { type: "string" } },
      gap: { type: "string" },
      blamed_prerequisite: { type: "string", enum: [...prereqs, "none"] },
      socratic_hint: { type: "string" },
    },
    required: ["verdict", "mastery_evidence", "understood", "gap", "blamed_prerequisite", "socratic_hint"],
  };
}

function firstJson<T>(msg: Anthropic.Message): T {
  const block = msg.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("no text block in response");
  // Strip optional markdown code fences (```json … ``` or ``` … ```)
  const raw = block.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  return JSON.parse(raw) as T;
}

async function anthropicGenerate(node: NodeRow, prereqs: string[], recentGaps: string[] = [], preferKind?: ProblemKind): Promise<GeneratedProblem> {
  const msg = await anthropic!.messages.create({
    model: ANTHROPIC_PROBLEM_MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: AUTHOR_SYSTEM + "\n\nIMPORTANT: Respond ONLY with a single valid JSON object — no markdown fences, no preamble.", cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: problemUserText(node, prereqs, recentGaps, preferKind) }],
  });
  return firstJson<GeneratedProblem>(msg);
}

async function anthropicGrade(a: Parameters<typeof gradeAnswer>[0]): Promise<GradeResult> {
  const msg = await anthropic!.messages.create({
    model: ANTHROPIC_GRADE_MODEL,
    max_tokens: 2048,
    system: [{ type: "text", text: GRADER_SYSTEM + "\n\nIMPORTANT: Respond ONLY with a single valid JSON object — no markdown fences, no preamble.", cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: gradeUserText(a) }],
  });
  return firstJson<GradeResult>(msg);
}

// ===========================================================================
// Compare two concepts
// ===========================================================================
export async function compareConcepts(
  nodeA: NodeRow,
  nodeB: NodeRow
): Promise<string> {
  if (PROVIDER === "none") return "";
  const prompt = [
    `Compare and contrast these two mathematical concepts:\n`,
    `CONCEPT A: ${nodeA.title}`,
    nodeA.type    ? `  Type: ${nodeA.type}` : "",
    nodeA.area    ? `  Area: ${nodeA.area}` : "",
    nodeA.overview ? `  Overview: ${nodeA.overview}` : "",
    nodeA.content  ? `  Note (excerpt):\n${nodeA.content.slice(0, 2000)}` : "",
    `\nCONCEPT B: ${nodeB.title}`,
    nodeB.type    ? `  Type: ${nodeB.type}` : "",
    nodeB.area    ? `  Area: ${nodeB.area}` : "",
    nodeB.overview ? `  Overview: ${nodeB.overview}` : "",
    nodeB.content  ? `  Note (excerpt):\n${nodeB.content.slice(0, 2000)}` : "",
    `\nWrite a structured comparison in markdown with these sections:`,
    `## Similarities`,
    `## Key Differences`,
    `## When to Use Each`,
    `## Example that Distinguishes Them`,
    `Be concise and precise. Use LaTeX ($...$) for all mathematics. Address the student as "you".`,
  ].filter(Boolean).join("\n");

  if (PROVIDER === "gemini") {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 2000, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  }

  if (PROVIDER === "anthropic" && anthropic) {
    const msg = await anthropic.messages.create({
      model: ANTHROPIC_GRADE_MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    return (msg.content[0] as any)?.text?.trim() ?? "";
  }

  return "";
}

// ===========================================================================
// Re-explain from a different angle
// ===========================================================================
export type ExplainAngle = "intuitive" | "formal" | "visual" | "historical" | "example";

const ANGLE_DESC: Record<ExplainAngle, string> = {
  intuitive: "Use plain language, everyday analogies, and real-world intuition. Avoid formalism where possible. Imagine explaining to a smart non-mathematician.",
  formal:    "Start from first principles, state definitions with precision, avoid hand-waving. Use rigorous mathematical language and LaTeX throughout.",
  visual:    "Lead with a diagram description or geometric intuition. Describe what you would draw, what curves/sets/shapes to picture. Use spatial reasoning.",
  historical: "Frame the explanation through history: who introduced this concept, what problem motivated it, how the idea evolved. Humanise the mathematics.",
  example:   "Teach through a concrete worked example first, then generalise. Start with a specific, illuminating case and extract the pattern.",
};

export async function reExplainConcept(
  node: NodeRow,
  prereqs: string[],
  angle: ExplainAngle = "intuitive"
): Promise<string> {
  if (PROVIDER === "none") return "";
  const angleGuide = ANGLE_DESC[angle];
  const prompt = [
    `Re-explain the mathematical concept "${node.title}" from a DIFFERENT ANGLE than a standard textbook.`,
    node.type    ? `Type: ${node.type}` : "",
    node.area    ? `Area: ${node.area}` : "",
    node.overview ? `Standard overview: ${node.overview}` : "",
    node.content  ? `\nFull note (reference, do NOT merely paraphrase it):\n${node.content.slice(0, 3000)}` : "",
    prereqs.length ? `\nThe student already knows: ${prereqs.join(", ")}` : "",
    `\nANGLE: ${angle.toUpperCase()}\n${angleGuide}`,
    `\nWrite 2–4 focused paragraphs. Use LaTeX ($...$) for mathematics. Address the student as "you". Do NOT just restate the definition — add genuine insight from this angle.`,
  ].filter(Boolean).join("\n");

  if (PROVIDER === "gemini") {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.75, maxOutputTokens: 1500, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  }

  if (PROVIDER === "anthropic" && anthropic) {
    const msg = await anthropic.messages.create({
      model: ANTHROPIC_GRADE_MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    return (msg.content[0] as any)?.text?.trim() ?? "";
  }

  return "";
}

// ===========================================================================
// Note improvement
// ===========================================================================
const IMPROVE_SYSTEM = `You are an expert mathematician editing atomic notes in an Obsidian math vault.
You receive a note (YAML frontmatter + markdown body) and return an improved version.
Rules:
- Preserve the YAML frontmatter EXACTLY as-is
- Keep all existing [[wikilinks]] and section headers
- You MAY: clarify the statement for greater precision, add a one-sentence motivation or intuition if missing, add a concrete example if none exists, fix notation inconsistencies, add missing [[wikilinks]] to concepts you reference by name
- Do NOT restructure the entire note or change its scope
- Return ONLY the improved note (frontmatter + body), no preamble`;

const IMPROVE_SCHEMA_G = {
  type: "OBJECT",
  properties: { improved_content: { type: "STRING" } },
  required: ["improved_content"],
  propertyOrdering: ["improved_content"],
};

export async function improveNote(content: string, title: string, type: string | null): Promise<string> {
  const userText = `TITLE: ${title}\nTYPE: ${type || "note"}\n\nNOTE:\n${content}\n\nReturn the improved note.`;
  if (PROVIDER === "gemini") {
    const r = await geminiCall(IMPROVE_SYSTEM, userText, IMPROVE_SCHEMA_G, 0.4);
    return r.improved_content as string;
  }
  if (PROVIDER === "anthropic") {
    const msg = await anthropic!.messages.create({
      model: ANTHROPIC_PROBLEM_MODEL,
      max_tokens: 8000,
      system: IMPROVE_SYSTEM,
      messages: [{ role: "user", content: userText }],
    });
    const block = msg.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") throw new Error("no text in response");
    return block.text;
  }
  throw new Error("No LLM provider configured — set GEMINI_API_KEY or ANTHROPIC_API_KEY.");
}

// ===========================================================================
// Study plan generation
// ===========================================================================
export type StudyPlanInput = {
  targetDate: string;           // ISO date like "2026-07-01"
  focusArea?: string;           // optional area to prioritize
  totalConcepts: number;
  masteredConcepts: number;
  weakAreas: { area: string; avg_p: number; count: number }[];
  unmastered: { id: string; title: string; area: string | null; mastery_p: number }[];
};

/** Generate a markdown study plan for an upcoming exam/deadline. */
export async function generateStudyPlan(input: StudyPlanInput): Promise<string> {
  if (PROVIDER === "none") return "";

  const today = new Date().toISOString().slice(0, 10);
  const daysLeft = Math.ceil((new Date(input.targetDate).getTime() - new Date(today).getTime()) / 86400000);
  const weeksLeft = Math.max(1, Math.round(daysLeft / 7));

  const weakest = input.weakAreas.slice(0, 6).map(a => `${a.area} (${Math.round(a.avg_p * 100)}%)`).join(", ");
  const frontier = input.unmastered.slice(0, 20).map(n => `- ${n.title} (${n.area ?? "?"}, ${Math.round(n.mastery_p * 100)}%)`).join("\n");

  const prompt = [
    `You are an expert mathematics tutor and study strategist.`,
    `A student is preparing for an exam on ${input.targetDate} (${daysLeft} days / ~${weeksLeft} week(s) away).`,
    `\nCurrent state:`,
    `- Total concepts in graph: ${input.totalConcepts}`,
    `- Already mastered: ${input.masteredConcepts} (${Math.round(input.masteredConcepts / input.totalConcepts * 100)}%)`,
    input.focusArea ? `- Priority area: ${input.focusArea}` : "",
    `- Weakest areas: ${weakest || "none yet"}`,
    `\nTop unmastered concepts (by priority):`,
    frontier || "(none — all mastered!)",
    `\nWrite a concrete, actionable study plan in markdown.`,
    `Structure it by week (Week 1, Week 2, ...) with a clear focus for each week.`,
    `For each week, list: the key concepts to master, suggested session modes (review/weak spots/frontier), and daily practice targets.`,
    `End with exam-week strategy and a motivational note.`,
    `Be specific: name actual concepts and areas from the data. Use bullet points. Keep it under 600 words.`,
  ].filter(Boolean).join("\n");

  if (PROVIDER === "gemini") {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 2000, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  }

  if (PROVIDER === "anthropic" && anthropic) {
    const msg = await anthropic.messages.create({
      model: ANTHROPIC_GRADE_MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    return (msg.content[0] as any)?.text?.trim() ?? "";
  }

  return "";
}

// ===========================================================================
// Error surfacing
// ===========================================================================
export function friendlyLLMError(e: unknown): { status: number; message: string } {
  if (e instanceof ProviderError) {
    if (e.status === 400 && /api[_ ]?key/i.test(e.message))
      return { status: 401, message: "Invalid GEMINI_API_KEY. Check the key in .env.local and restart the dev server." };
    if (e.status === 429)
      return { status: 429, message: "Gemini free-tier rate limit hit (~15 requests/min, or the daily cap). Wait a minute and try again." };
    if (e.status === 403)
      return { status: 403, message: "Gemini rejected the key (403). Make sure the Generative Language API is enabled for it at aistudio.google.com." };
    return { status: e.status || 502, message: `Gemini error: ${e.message}` };
  }
  if (e instanceof Anthropic.APIError) {
    const raw = (e as any)?.error?.error?.message || e.message || "API error";
    if (e.status === 400 && /credit balance/i.test(raw))
      return {
        status: 402,
        message:
          "Your Anthropic API account is out of credits. Either add credits at console.anthropic.com → Plans & Billing, or use the free Gemini path (set GEMINI_API_KEY in .env.local).",
      };
    if (e.status === 401) return { status: 401, message: "Invalid ANTHROPIC_API_KEY." };
    if (e.status === 429) return { status: 429, message: "Rate limited by the Anthropic API. Wait a moment." };
    return { status: e.status ?? 502, message: raw };
  }
  return { status: 500, message: e instanceof Error ? e.message : "Unexpected error" };
}

// ===========================================================================
// Demo stub (no key)
// ===========================================================================
function stubProblem(node: NodeRow): GeneratedProblem {
  const verb =
    node.type === "Definition"
      ? `State the definition of **${node.title}** precisely, then give one example and one non-example, justifying each.`
      : `State **${node.title}** precisely and sketch why it holds (or give the key idea of its proof).`;
  return {
    problem: `${verb}\n\n_(Demo problem — set GEMINI_API_KEY (free) or ANTHROPIC_API_KEY for AI-authored problems.)_`,
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
    verdict: words > 8 ? "partial" : "incorrect",
    mastery_evidence: evidence,
    understood: words > 8 ? ["You attempted an explanation."] : [],
    gap: "Demo mode: real diagnosis n
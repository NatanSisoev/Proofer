import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { db } from "./db";
import type { NodeRow } from "./db";

// ===========================================================================
// LLM response cache — SQLite-backed, 7-day TTL, keyed by SHA-256 of inputs.
// Only used for the "read-only" explanation/comparison calls, never
// for problem generation or grading (which must be fresh per attempt).
// ===========================================================================
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function cacheKey(fn: string, input: unknown): string {
  return createHash("sha256")
    .update(fn + "\0" + JSON.stringify(input))
    .digest("hex");
}

function cacheGet(key: string): string | null {
  try {
    const row = db().prepare(
      "SELECT value, created_at FROM llm_cache WHERE key = ?"
    ).get(key) as { value: string; created_at: number } | undefined;
    if (!row) return null;
    const age = Math.floor(Date.now() / 1000) - row.created_at;
    if (age > CACHE_TTL_SECONDS) {
      db().prepare("DELETE FROM llm_cache WHERE key = ?").run(key);
      return null;
    }
    return row.value;
  } catch {
    return null; // cache errors must never break the app
  }
}

function cacheSet(key: string, value: string): void {
  try {
    db().prepare(
      "INSERT OR REPLACE INTO llm_cache (key, value, created_at) VALUES (?, ?, ?)"
    ).run(key, value, Math.floor(Date.now() / 1000));
  } catch {
    // ignore write failures
  }
}

/** Clear the entire LLM cache (called on vault sync so stale content is dropped). */
export function clearLLMCache(): void {
  try {
    db().prepare("DELETE FROM llm_cache").run();
  } catch {
    // ignore
  }
}

// Provider selection: Gemini (free tier) wins if its key is set; else Anthropic;
// else a demo stub. The LLM layer is the only provider-aware part of the app.
// Keys can come from the Settings page (stored in the `settings` table) or
// from .env.local — the settings table wins so the UI can override env vars
// without a restart.
function readSettings(): Record<string, string> {
  try {
    const rows = db().prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}

// Models. Gemini 2.5 Flash has free-tier quota (2.0-flash is limit:0 in some
// regions, e.g. the EU) and is stronger at math reasoning.
const ANTHROPIC_PROBLEM_MODEL = "claude-opus-4-8";
const ANTHROPIC_GRADE_MODEL = "claude-opus-4-8";

type LLMConfig = {
  provider: "gemini" | "anthropic" | "none";
  geminiKey: string;
  geminiModel: string;
  anthropic: Anthropic | null;
};

/** Re-reads keys from settings/env on every call so a key saved in Settings
 *  takes effect immediately, with no server restart. Cheap: one sync SELECT. */
function getLLMConfig(): LLMConfig {
  const s = readSettings();
  const geminiKey = (s.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  const anthropicKey = (s.anthropic_api_key || process.env.ANTHROPIC_API_KEY || "").trim();
  return {
    provider: geminiKey ? "gemini" : anthropicKey ? "anthropic" : "none",
    geminiKey,
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    anthropic: anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null,
  };
}

/** The currently active LLM provider, derived from Settings/env. */
export function getProvider(): "gemini" | "anthropic" | "none" {
  return getLLMConfig().provider;
}

/** Whether any LLM key is currently configured (Settings or env). */
export function hasKey(): boolean {
  return getProvider() !== "none";
}

export type ProviderInfo = {
  provider: "gemini" | "anthropic" | "none";
  label: string;       // human-readable provider name
  model: string | null; // active model id, or null in demo mode
  hasKey: boolean;
};

/** The currently active LLM provider + model, for surfacing in the UI so users
 *  know which tier (Gemini → Anthropic → demo stub) is answering. */
export function providerInfo(): ProviderInfo {
  const cfg = getLLMConfig();
  if (cfg.provider === "gemini") return { provider: "gemini", label: "Google Gemini", model: cfg.geminiModel, hasKey: true };
  if (cfg.provider === "anthropic") return { provider: "anthropic", label: "Anthropic Claude", model: ANTHROPIC_PROBLEM_MODEL, hasKey: true };
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

// Translate the student's current mastery (0..1) into a difficulty instruction.
// Goal: the "desirable difficulty" band — a problem they should solve ~85% of
// the time at their current level, so practice is winnable but not trivial.
function difficultyHint(masteryP?: number): string {
  if (masteryP === undefined) return "";
  if (masteryP < 0.3)
    return `\nDIFFICULTY: This student is early on this concept. Test the core idea directly and concretely — no edge cases or unusual setups. They should be able to solve it if they grasp the basic definition.`;
  if (masteryP < 0.7)
    return `\nDIFFICULTY: This student has a partial grasp. Aim for standard difficulty — a problem that applies the concept in a typical way and rewards genuine understanding over memorization.`;
  return `\nDIFFICULTY: This student is close to mastering this concept. Include a subtle case, edge condition, or a step that requires combining it with a prerequisite — something only solid understanding handles.`;
}

function problemUserText(node: NodeRow, prereqs: string[], recentGaps: string[] = [], preferKind?: ProblemKind, masteryP?: number): string {
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
    difficultyHint(masteryP),
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
export async function generateProblem(node: NodeRow, prereqs: string[], recentGaps: string[] = [], preferKind?: ProblemKind, masteryP?: number): Promise<GeneratedProblem> {
  const cfg = getLLMConfig();
  if (cfg.provider === "gemini") return geminiGenerate(node, prereqs, recentGaps, preferKind, cfg, masteryP);
  if (cfg.provider === "anthropic") return anthropicGenerate(node, prereqs, recentGaps, preferKind, cfg.anthropic!, masteryP);
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
  const cfg = getLLMConfig();
  let r: GradeResult;
  if (cfg.provider === "gemini") r = await geminiGrade(args, cfg);
  else if (cfg.provider === "anthropic") r = await anthropicGrade(args, cfg.anthropic!);
  else r = stubGrade(args.answer);
  if (r.blamed_prerequisite === "none") r.blamed_prerequisite = "";
  r.mastery_evidence = Math.max(0, Math.min(1, r.mastery_evidence));
  return r;
}

export async function explainConcept(
  node: import("./db").NodeRow,
  prereqs: string[]
): Promise<string> {
  const cfg = getLLMConfig();
  if (cfg.provider === "none") return "";
  const ck = cacheKey("explainConcept", { id: node.id, prereqs });
  const hit = cacheGet(ck);
  if (hit) return hit;
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

  let result = "";
  if (cfg.provider === "gemini") {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${cfg.geminiModel}:generateContent?key=${cfg.geminiKey}`,
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
    result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  } else if (cfg.provider === "anthropic" && cfg.anthropic) {
    const msg = await cfg.anthropic.messages.create({
      model: ANTHROPIC_GRADE_MODEL,
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });
    result = (msg.content[0] as any)?.text?.trim() ?? "";
  }
  if (result) cacheSet(ck, result);
  return result;
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
  const cfg = getLLMConfig();
  if (cfg.provider === "none") return "No AI provider configured — set GEMINI_API_KEY for hints.";
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

  if (cfg.provider === "gemini") {
    const result = await geminiCall(
      "You are a Socratic math tutor. Give hints that guide, never answers that reveal.",
      prompt,
      HINT_SCHEMA_G,
      0.6,
      cfg
    );
    return result.hint as string;
  }

  if (cfg.provider === "anthropic" && cfg.anthropic) {
    const msg = await cfg.anthropic.messages.create({
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
  const cfg = getLLMConfig();
  if (cfg.provider === "none") return "";
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

  if (cfg.provider === "gemini") {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${cfg.geminiModel}:generateContent?key=${cfg.geminiKey}`,
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

  if (cfg.provider === "anthropic" && cfg.anthropic) {
    const msg = await cfg.anthropic.messages.create({
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

async function geminiCall(system: string, userText: string, schema: unknown, temperature: number, cfg: LLMConfig): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.geminiModel}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.geminiKey },
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

async function geminiGenerate(node: NodeRow, prereqs: string[], recentGaps: string[] = [], preferKind: ProblemKind | undefined, cfg: LLMConfig, masteryP?: number): Promise<GeneratedProblem> {
  return geminiCall(AUTHOR_SYSTEM, problemUserText(node, prereqs, recentGaps, preferKind, masteryP), G_PROBLEM_SCHEMA, 0.8, cfg);
}

async function geminiGrade(a: Parameters<typeof gradeAnswer>[0], cfg: LLMConfig): Promise<GradeResult> {
  return geminiCall(GRADER_SYSTEM, gradeUserText(a), gGradeSchema(a.prereqs), 0.2, cfg);
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

async function anthropicGenerate(node: NodeRow, prereqs: string[], recentGaps: string[] = [], preferKind: ProblemKind | undefined, anthropic: Anthropic, masteryP?: number): Promise<GeneratedProblem> {
  const msg = await anthropic.messages.create({
    model: ANTHROPIC_PROBLEM_MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: AUTHOR_SYSTEM + "\n\nIMPORTANT: Respond ONLY with a single valid JSON object — no markdown fences, no preamble.", cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: problemUserText(node, prereqs, recentGaps, preferKind, masteryP) }],
  });
  return firstJson<GeneratedProblem>(msg);
}

async function anthropicGrade(a: Parameters<typeof gradeAnswer>[0], anthropic: Anthropic): Promise<GradeResult> {
  const msg = await anthropic.messages.create({
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
  const cfg = getLLMConfig();
  if (cfg.provider === "none") return "";
  const ck = cacheKey("compareConcepts", { a: nodeA.id, b: nodeB.id });
  const hit = cacheGet(ck);
  if (hit) return hit;
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

  let result = "";
  if (cfg.provider === "gemini") {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${cfg.geminiModel}:generateContent?key=${cfg.geminiKey}`,
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
    result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  } else if (cfg.provider === "anthropic" && cfg.anthropic) {
    const msg = await cfg.anthropic.messages.create({
      model: ANTHROPIC_GRADE_MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    result = (msg.content[0] as any)?.text?.trim() ?? "";
  }
  if (result) cacheSet(ck, result);
  return result;
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
  const cfg = getLLMConfig();
  if (cfg.provider === "none") return "";
  const ck = cacheKey("reExplainConcept", { id: node.id, prereqs, angle });
  const hit = cacheGet(ck);
  if (hit) return hit;
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

  let result = "";
  if (cfg.provider === "gemini") {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${cfg.geminiModel}:generateContent?key=${cfg.geminiKey}`,
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
    result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  } else if (cfg.provider === "anthropic" && cfg.anthropic) {
    const msg = await cfg.anthropic.messages.create({
      model: ANTHROPIC_GRADE_MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    result = (msg.content[0] as any)?.text?.trim() ?? "";
  }
  if (result) cacheSet(ck, result);
  return result;
}

// ===========================================================================
// Edge classification — retype `related` edges to a specific relationship
// ===========================================================================
export type EdgeClassification = {
  suggested_type: "depends_on" | "generalizes" | "equivalent_to" | "instance_of" | "contradicts" | "related";
  confidence: number;   // 0..1
  reasoning: string;    // one sentence justifying the choice
};

const EDGE_CLASSIFY_SYSTEM = `You are an expert mathematician classifying relationships between mathematical concepts.
Given two concepts (A and B) currently linked as "related" (unclassified), determine the most accurate relationship type:
- depends_on:    A depends on B — B is a prerequisite or foundational result used in A (directed)
- generalizes:   A generalizes B — B is a special case of A (directed)
- equivalent_to: A and B are two names/formulations of the same thing (symmetric)
- instance_of:   A is a concrete example, application, or instance of B (directed)
- contradicts:   A refutes, limits, or is a counterexample to B
- related:       None of the above fit well — keep as unclassified
Choose "related" only if truly no stronger type applies.`;

const EDGE_SCHEMA_G = {
  type: "OBJECT",
  properties: {
    suggested_type: { type: "STRING", enum: ["depends_on", "generalizes", "equivalent_to", "instance_of", "contradicts", "related"] },
    confidence:     { type: "NUMBER" },
    reasoning:      { type: "STRING" },
  },
  required: ["suggested_type", "confidence", "reasoning"],
  propertyOrdering: ["suggested_type", "confidence", "reasoning"],
};

export async function classifyEdge(a: {
  src_title: string; src_type: string | null; src_area: string | null; src_overview: string | null;
  tgt_title: string; tgt_type: string | null; tgt_area: string | null; tgt_overview: string | null;
  context: string | null;
}): Promise<EdgeClassification> {
  const cfg = getLLMConfig();
  if (cfg.provider === "none") throw new Error("No AI provider configured");

  const prompt = [
    `Classify the relationship between these two mathematical concepts:`,
    ``,
    `CONCEPT A: ${a.src_title}${a.src_type ? ` (${a.src_type})` : ""}${a.src_area ? `, ${a.src_area}` : ""}`,
    a.src_overview ? `  Overview: ${a.src_overview}` : "",
    ``,
    `CONCEPT B: ${a.tgt_title}${a.tgt_type ? ` (${a.tgt_type})` : ""}${a.tgt_area ? `, ${a.tgt_area}` : ""}`,
    a.tgt_overview ? `  Overview: ${a.tgt_overview}` : "",
    a.context ? `\nContext (text from the note that originally linked them): ${a.context}` : "",
    ``,
    `What is the most accurate relationship FROM A TO B? Respond as JSON.`,
  ].filter(Boolean).join("\n");

  if (cfg.provider === "gemini") {
    return geminiCall(EDGE_CLASSIFY_SYSTEM, prompt, EDGE_SCHEMA_G, 0.2, cfg);
  }

  if (cfg.provider === "anthropic" && cfg.anthropic) {
    const msg = await cfg.anthropic.messages.create({
      model: ANTHROPIC_GRADE_MODEL,
      max_tokens: 300,
      system: EDGE_CLASSIFY_SYSTEM + "\n\nIMPORTANT: Respond ONLY with a single valid JSON object — no markdown fences, no preamble.",
      messages: [{ role: "user", content: prompt }],
    });
    return firstJson<EdgeClassification>(msg);
  }

  throw new Error("No AI provider configured");
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
  const cfg = getLLMConfig();
  const userText = `TITLE: ${title}\nTYPE: ${type || "note"}\n\nNOTE:\n${content}\n\nReturn the improved note.`;
  if (cfg.provider === "gemini") {
    const r = await geminiCall(IMPROVE_SYSTEM, userText, IMPROVE_SCHEMA_G, 0.4, cfg);
    return r.improved_content as string;
  }
  if (cfg.provider === "anthropic") {
    const msg = await cfg.anthropic!.messages.create({
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
    gap: "Demo mode: real diagnosis needs an API key. This placeholder scores by answer length only.",
    blamed_prerequisite: "",
    socratic_hint: "Set GEMINI_API_KEY (free at aistudio.google.com) to get a real Socratic hint that pinpoints your specific gap.",
  };
}

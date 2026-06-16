import { NextRequest, NextResponse } from "next/server";
import { classifyEdge, friendlyLLMError, HAS_KEY } from "@/lib/llm";
import type { RelatedEdge } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ask the LLM to classify one or more `related` edges.
 * Accepts { edges: RelatedEdge[] } — batch up to 20 at once.
 * Returns { results: { src_id, tgt_id, ...EdgeClassification }[] }
 * Does NOT write to the database — the client confirms before retying.
 */
export async function POST(req: NextRequest) {
  if (!HAS_KEY) {
    return NextResponse.json({ error: "No AI provider configured — set GEMINI_API_KEY or ANTHROPIC_API_KEY" }, { status: 400 });
  }

  const { edges } = await req.json() as { edges: RelatedEdge[] };
  if (!Array.isArray(edges) || edges.length === 0) {
    return NextResponse.json({ error: "edges array required" }, { status: 400 });
  }

  const batch = edges.slice(0, 20); // cap to avoid timeouts
  const results = await Promise.allSettled(
    batch.map(async (e) => {
      const classification = await classifyEdge({
        src_title: e.src_title, src_type: e.src_type, src_area: e.src_area, src_overview: e.src_overview,
        tgt_title: e.tgt_title, tgt_type: e.tgt_type, tgt_area: e.tgt_area, tgt_overview: e.tgt_overview,
        context: e.context,
      });
      return { src_id: e.src_id, tgt_id: e.tgt_id, ...classification };
    })
  );

  const successes = results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
    .map((r) => r.value);

  const failures = results.filter((r) => r.status === "rejected").length;

  if (successes.length === 0 && failures > 0) {
    const first = (results[0] as PromiseRejectedResult).reason;
    const { status, message } = friendlyLLMError(first);
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ results: successes, failures });
}

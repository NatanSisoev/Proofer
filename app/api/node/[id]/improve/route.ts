import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import { getNode } from "@/lib/queries";
import { improveNote, friendlyLLMError, hasKey } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const node = getNode(decodeURIComponent(id));
  if (!node || node.exists_ === 0) return NextResponse.json({ error: "node not found" }, { status: 404 });
  if (!node.path) return NextResponse.json({ error: "no source file for this node" }, { status: 400 });
  if (!hasKey()) return NextResponse.json({ error: "No LLM provider configured — set an API key in Settings or GEMINI_API_KEY/ANTHROPIC_API_KEY in .env.local." }, { status: 400 });

  let original: string;
  try {
    original = readFileSync(node.path, "utf8");
  } catch {
    return NextResponse.json({ error: `Cannot read file: ${node.path}` }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));

  // apply=true writes the (already-generated) content back; apply=false generates and previews
  if (body.apply) {
    const content: string = body.content;
    if (!content) return NextResponse.json({ error: "no content to apply" }, { status: 400 });
    try {
      writeFileSync(node.path, content, "utf8");
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      return NextResponse.json({ error: `Failed to write file: ${e.message}` }, { status: 500 });
    }
  }

  let improved: string;
  try {
    improved = await improveNote(original, node.title, node.type);
  } catch (e) {
    const { status, message } = friendlyLLMError(e);
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ improved });
}

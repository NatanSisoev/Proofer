import { NextRequest, NextResponse } from "next/server";
import { renderTikz } from "@/lib/tikz";

export const dynamic = "force-dynamic";
// A cold compile runs the WASM TeX engine; several queued figures serialise
// behind each other, so allow well past the default.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const { source } = await req.json();
  if (typeof source !== "string" || !source.trim()) {
    return NextResponse.json({ error: "missing source" }, { status: 400 });
  }
  const { svg, error } = await renderTikz(source);
  return NextResponse.json({ svg, error });
}

import { NextResponse } from "next/server";
import { providerInfo } from "@/lib/llm";

export const dynamic = "force-dynamic";

// Exposes the active LLM provider + model so the (client-side) Settings page
// can show which tier is currently answering without bundling server-only env.
export function GET() {
  return NextResponse.json(providerInfo());
}

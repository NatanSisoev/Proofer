import { NextRequest, NextResponse } from "next/server";
import { setKnown } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { id, known } = await req.json();
  if (typeof id !== "string") return NextResponse.json({ error: "id required" }, { status: 400 });
  setKnown(id, !!known);
  return NextResponse.json({ ok: true });
}

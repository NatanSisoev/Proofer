import { NextResponse } from "next/server";
import { misconceptionCandidates } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** List concepts with enough failed/partial attempts to look for a recurring misconception. */
export async function GET() {
  const candidates = misconceptionCandidates(2, 50);
  return NextResponse.json({ candidates });
}

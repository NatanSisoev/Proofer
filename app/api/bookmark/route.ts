import { NextRequest, NextResponse } from "next/server";
import { toggleBookmark } from "@/lib/queries";

export async function POST(req: NextRequest) {
  const { nodeId } = await req.json();
  if (!nodeId) return NextResponse.json({ error: "nodeId required" }, { status: 400 });
  const isNowBookmarked = toggleBookmark(nodeId);
  return NextResponse.json({ bookmarked: isNowBookmarked });
}

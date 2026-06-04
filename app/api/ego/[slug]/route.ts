import { NextRequest, NextResponse } from "next/server";
import { egoGraph } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const depth = Number(req.nextUrl.searchParams.get("depth") || "1");
  return NextResponse.json(egoGraph(decodeURIComponent(slug), Math.min(Math.max(depth, 1), 2)));
}

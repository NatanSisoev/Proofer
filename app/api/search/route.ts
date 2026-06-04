import { NextRequest, NextResponse } from "next/server";
import { search } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  if (q.trim().length < 2) return NextResponse.json([]);
  const hits = search(q.trim()).map((n) => ({
    id: n.id,
    title: n.title,
    type: n.type,
    area: n.area,
    overview: n.overview,
  }));
  return NextResponse.json(hits);
}

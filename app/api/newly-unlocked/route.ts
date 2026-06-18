import { NextRequest, NextResponse } from "next/server";
import { newlyUnlocked } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("nodes")?.split(",").filter(Boolean) ?? [];
  if (ids.length === 0) return NextResponse.json([]);

  const seen = new Set<string>();
  const results: { id: string; title: string; area: string | null; type: string | null }[] = [];

  for (const id of ids.slice(0, 20)) {
    for (const n of newlyUnlocked(id)) {
      if (!seen.has(n.id)) {
        seen.add(n.id);
        results.push({ id: n.id, title: n.title, area: n.area, type: n.type });
      }
    }
  }

  return NextResponse.json(results);
}

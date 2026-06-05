import { NextRequest, NextResponse } from "next/server";
import { graphData, stats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const area = req.nextUrl.searchParams.get("area") || undefined;
  const data = graphData(area);
  const s = stats();
  return NextResponse.json({ ...data, areas: s.areas });
}

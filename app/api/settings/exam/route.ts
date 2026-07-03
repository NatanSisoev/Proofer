import { NextRequest, NextResponse } from "next/server";
import { setExamDate, getExamDates } from "@/lib/settings";
import { browseAreas } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** GET — areas to choose from + currently-set area exam targets, for the
 *  Settings page (a client component, hence its own fetch instead of a
 *  server-rendered prop). */
export async function GET() {
  const areas = browseAreas().map((a) => a.area);
  const dates = getExamDates();
  const targets = Object.entries(dates)
    .filter(([key]) => key.startsWith("area:"))
    .map(([key, date]) => ({ area: key.slice("area:".length), date }));
  return NextResponse.json({ areas, targets });
}

/** POST { scopeType: "area", scopeValue: string, date: string } — set the
 *  exam date for a scope. Omit/empty `date` to clear it. */
export async function POST(req: NextRequest) {
  try {
    const { scopeType, scopeValue, date } = (await req.json()) as {
      scopeType?: string;
      scopeValue?: string;
      date?: string;
    };
    if (scopeType !== "area" && scopeType !== "source") {
      return NextResponse.json({ error: "scopeType must be 'area' or 'source'" }, { status: 400 });
    }
    const value = (scopeValue || "").trim();
    if (!value) return NextResponse.json({ error: "scopeValue required" }, { status: 400 });

    setExamDate(`${scopeType}:${value}`, (date || "").trim() || null);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}

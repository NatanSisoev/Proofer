import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { targetId, type = "related" } = await req.json();
  if (!targetId) return NextResponse.json({ error: "targetId required" }, { status: 400 });

  const existing = db()
    .prepare("SELECT 1 FROM edges WHERE (src=? AND dst=?) OR (src=? AND dst=?)")
    .get(id, targetId, targetId, id);
  if (existing) return NextResponse.json({ ok: true, existed: true });

  // `source` is NOT NULL with no default — omitting it threw a constraint
  // error, so every "Add link" click on /quality?tab=links was a 500 and no
  // edge was ever added. This edge comes from the heuristic unlinked-mention
  // detector, matching the value every existing edge already carries.
  db().prepare(
    "INSERT INTO edges (src, dst, type, confidence, source) VALUES (?, ?, ?, 0.7, 'heuristic')"
  ).run(id, targetId, type);

  return NextResponse.json({ ok: true });
}

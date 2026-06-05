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

  db().prepare(
    "INSERT INTO edges (src, dst, type, confidence) VALUES (?, ?, ?, 0.7)"
  ).run(id, targetId, type);

  return NextResponse.json({ ok: true });
}

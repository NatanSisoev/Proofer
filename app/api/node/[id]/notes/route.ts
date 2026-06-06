import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = db().prepare("SELECT content FROM node_notes WHERE node_id = ?").get(id) as { content: string } | undefined;
  return NextResponse.json({ content: row?.content ?? "" });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { content } = await req.json();
  if (typeof content !== "string") return NextResponse.json({ error: "content required" }, { status: 400 });

  db().prepare(
    `INSERT INTO node_notes(node_id, content, updated_at)
     VALUES(?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
     ON CONFLICT(node_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`
  ).run(id, content);

  return NextResponse.json({ ok: true });
}

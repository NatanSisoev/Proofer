import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = db()
    .prepare(
      `SELECT n.title, nn.content, nn.updated_at
         FROM node_notes nn
         JOIN nodes n ON n.id = nn.node_id
        WHERE nn.content != ''
        ORDER BY n.title ASC`
    )
    .all() as { title: string; content: string; updated_at: string }[];

  if (rows.length === 0) {
    return new NextResponse("# Personal Notes\n\n(no notes yet)", {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="proofer-notes.md"`,
      },
    });
  }

  const lines: string[] = ["# Personal Notes\n", `_Exported from Proofer · ${new Date().toISOString().slice(0, 10)}_\n`];
  for (const r of rows) {
    lines.push(`\n---\n\n## ${r.title}\n`);
    lines.push(`_Last updated: ${r.updated_at.slice(0, 10)}_\n`);
    lines.push(`\n${r.content}\n`);
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="proofer-notes.md"`,
    },
  });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = db()
    .prepare(
      `SELECT n.id, n.title, n.type, n.area,
              COALESCE(m.p, 0) AS mastery_p,
              COALESCE(m.attempts, 0) AS attempts,
              m.last_seen
         FROM nodes n
         LEFT JOIN mastery m ON m.node_id = n.id
        WHERE n.exists_ = 1
        ORDER BY n.area ASC, mastery_p DESC`
    )
    .all() as {
      id: string; title: string; type: string | null; area: string | null;
      mastery_p: number; attempts: number; last_seen: string | null;
    }[];

  const header = "id,title,type,area,mastery_pct,attempts,last_seen\n";
  const csv = rows
    .map((r) => [
      JSON.stringify(r.id),
      JSON.stringify(r.title),
      JSON.stringify(r.type ?? ""),
      JSON.stringify(r.area ?? ""),
      Math.round(r.mastery_p * 100),
      r.attempts,
      JSON.stringify(r.last_seen ?? ""),
    ].join(","))
    .join("\n");

  return new NextResponse(header + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="proofer-mastery.csv"`,
    },
  });
}

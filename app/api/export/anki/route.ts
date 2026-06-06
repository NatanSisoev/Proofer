import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/export/anki?mastered=false (default) | all
 * Returns Anki-compatible tab-separated values: front\tback\ttags
 *
 * Anki import: File → Import → select TSV, set field separator to Tab,
 *   Fields: Front, Back, Tags. Then import.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const masteredParam = url.searchParams.get("mastered") ?? "false";

  const masteredWhere = masteredParam === "false"
    ? "AND (m.p IS NULL OR m.p < 0.8)"
    : "";

  const rows = db()
    .prepare(
      `SELECT n.id, n.title, n.type, n.area, n.overview, n.content,
              COALESCE(m.p, 0) AS mastery_p
         FROM nodes n
         LEFT JOIN mastery m ON m.node_id = n.id
        WHERE n.exists_ = 1
          ${masteredWhere}
        ORDER BY n.area ASC, n.title ASC`
    )
    .all() as {
      id: string; title: string; type: string | null; area: string | null;
      overview: string | null; content: string | null; mastery_p: number;
    }[];

  // Build Anki TSV: front = title + (type); back = overview + content excerpt; tags = area
  const lines: string[] = [];
  lines.push("#separator:tab");
  lines.push("#html:false");
  lines.push("#notetype:Basic");
  lines.push("#deck:Proofer");

  for (const r of rows) {
    const front = r.type ? `${r.title} [${r.type}]` : r.title;
    let back = "";
    if (r.overview) back += r.overview;
    if (r.content) {
      // Strip markdown headers and take first 300 chars of body
      const body = r.content
        .replace(/^#+\s+.*/gm, "")  // remove headings
        .replace(/\*\*/g, "")        // bold
        .replace(/\*/g, "")          // italic
        .replace(/`[^`]+`/g, "")     // inline code
        .replace(/\n{3,}/g, "\n\n")  // collapse whitespace
        .trim();
      if (body && body !== r.overview) {
        back += (back ? "\n\n" : "") + body.slice(0, 400) + (body.length > 400 ? "…" : "");
      }
    }
    if (!back) back = "(no content)";

    const tags = [r.area, r.type]
      .filter(Boolean)
      .map(t => (t as string).replace(/\s+/g, "_"))
      .join(" ");

    // Escape tabs and newlines within fields
    const escapedFront = front.replace(/\t/g, " ").replace(/\n/g, " ");
    const escapedBack = back.replace(/\t/g, " ").replace(/\n/g, " | ");
    const escapedTags = tags.replace(/\t/g, " ");

    lines.push(`${escapedFront}\t${escapedBack}\t${escapedTags}`);
  }

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="proofer-anki-${masteredParam === "false" ? "unmastered" : "all"}.txt"`,
    },
  });
}

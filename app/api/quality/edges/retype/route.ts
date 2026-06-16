import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set(["depends_on", "generalizes", "equivalent_to", "instance_of", "contradicts", "related"]);

/**
 * Change the type of an edge (src → dst) in the database.
 * Used by the /quality "Unclassified edges" tab to promote `related` edges
 * to a more specific relationship type after user review.
 */
export async function POST(req: NextRequest) {
  const { src, dst, newType } = await req.json();
  if (!src || !dst || !newType) {
    return NextResponse.json({ error: "src, dst, and newType are required" }, { status: 400 });
  }
  if (!VALID_TYPES.has(newType)) {
    return NextResponse.json({ error: `Invalid edge type: ${newType}` }, { status: 400 });
  }

  // Check if the target type already exists (would violate the PRIMARY KEY)
  const existing = db()
    .prepare("SELECT 1 FROM edges WHERE src = ? AND dst = ? AND type = ?")
    .get(src, dst, newType);

  if (existing) {
    // Target type already exists — just remove the `related` edge
    db().prepare("DELETE FROM edges WHERE src = ? AND dst = ? AND type = 'related'").run(src, dst);
    return NextResponse.json({ ok: true, merged: true });
  }

  const result = db()
    .prepare("UPDATE edges SET type = ? WHERE src = ? AND dst = ? AND type = 'related'")
    .run(newType, src, dst);

  if (result.changes === 0) {
    return NextResponse.json({ error: "Edge not found or already reclassified" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

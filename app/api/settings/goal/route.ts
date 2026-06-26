import { NextRequest, NextResponse } from "next/server";
import { setLearningGoal } from "@/lib/settings";
import { getNode } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** POST { nodeId: string } — set or clear (?nodeId="") the learning goal. */
export async function POST(req: NextRequest) {
  try {
    const { nodeId } = await req.json() as { nodeId?: string };
    const id = (nodeId || "").trim();

    // Validate the node exists (if setting, not clearing)
    if (id) {
      const node = getNode(id);
      if (!node || node.exists_ === 0) {
        return NextResponse.json({ error: "Node not found" }, { status: 404 });
      }
    }

    setLearningGoal(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}

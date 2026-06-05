import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getNode } from "@/lib/queries";

export const dynamic = "force-dynamic";

const VAULT_NOTES = process.env.VAULT_NOTES_PATH || "C:\\Users\\natan\\Mathematics\\Notes";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const nodeId = decodeURIComponent(id);
  const node = getNode(nodeId);
  if (!node) return NextResponse.json({ error: "node not found" }, { status: 404 });
  if (node.exists_ === 1) return NextResponse.json({ error: "note already exists" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const type: string = body.type || "";
  const area: string = body.area || node.area || "";

  const filename = `${nodeId}.md`;
  const filePath = join(VAULT_NOTES, filename);

  if (existsSync(filePath)) {
    return NextResponse.json({ error: "File already exists", path: filePath }, { status: 409 });
  }

  const frontmatter = [
    "---",
    `title: "${nodeId}"`,
    type ? `type: ${type}` : "type: ",
    area ? `field: ${area}` : "field: ",
    "---",
    "",
  ].join("\n");

  const body_content = [
    `## Statement`,
    "",
    "",
    `## Proof`,
    "",
    "",
    `## Examples`,
    "",
    "",
    `## Connections`,
    "",
  ].join("\n");

  try {
    writeFileSync(filePath, frontmatter + body_content, "utf8");
  } catch (e: any) {
    return NextResponse.json({ error: `Failed to create file: ${e.message}` }, { status: 500 });
  }

  const obsidianHref = `obsidian://open?path=${encodeURIComponent(filePath)}`;
  return NextResponse.json({ ok: true, path: filePath, obsidianHref });
}

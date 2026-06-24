import { NextResponse } from "next/server";
import { selectNext } from "@/lib/mastery";

export const dynamic = "force-dynamic";

export async function GET() {
  const node = selectNext();
  return NextResponse.json({ node: node ? { id: node.id, title: node.title } : null });
}

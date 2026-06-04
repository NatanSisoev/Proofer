import { NextResponse } from "next/server";
import { nextToPractice } from "@/lib/mastery";

export const dynamic = "force-dynamic";

export async function GET() {
  const node = nextToPractice();
  return NextResponse.json({ node: node ? { id: node.id, title: node.title } : null });
}

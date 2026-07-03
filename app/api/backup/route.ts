import { NextResponse } from "next/server";
import { db, BACKUP_DIR } from "@/lib/db";
import { readFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-") + "_" + [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("-");

  // Prefixed with "." so it's excluded from the daily-snapshot prune regex
  // (`graph-YYYY-MM-DD.db`) in lib/db.ts — this is a one-off, not a dated
  // rotation entry.
  const tmpPath = join(BACKUP_DIR, `.download-${stamp}.db`);
  db().exec(`VACUUM INTO '${tmpPath.replace(/'/g, "''")}'`);
  const buf = readFileSync(tmpPath);
  unlinkSync(tmpPath);

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="proofer-backup-${stamp}.db"`,
    },
  });
}

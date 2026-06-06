import { NextResponse } from "next/server";
import { todayStats } from "@/lib/queries";
import { getDailyGoal } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = todayStats();
  const daily_goal = getDailyGoal();
  return NextResponse.json({
    today_concepts: today.today_concepts,
    streak_days: today.streak_days,
    daily_goal,
  });
}

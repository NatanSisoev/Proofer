"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Data = { today_concepts: number; streak_days: number; daily_goal: number };

export default function DailyGoalIndicator() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch("/api/today")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  const { today_concepts, streak_days, daily_goal } = data;
  const pct = Math.min(100, Math.round((today_concepts / daily_goal) * 100));
  const done = today_concepts >= daily_goal;

  return (
    <Link
      href="/progress"
      title={`Today: ${today_concepts}/${daily_goal} concepts${streak_days > 0 ? ` · ${streak_days} day streak` : ""}`}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        textDecoration: "none", padding: "3px 8px",
        borderRadius: 6, border: "1px solid var(--border)",
        background: done ? "var(--accent-soft)" : "var(--bg-soft)",
        transition: "border-color 0.15s",
      }}
    >
      <div
        style={{
          position: "relative", width: 36, height: 6,
          background: "var(--bg)", borderRadius: 999, overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${pct}%`,
            background: done ? "var(--green)" : "var(--accent)",
            borderRadius: 999,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: done ? "var(--green)" : "var(--muted)", letterSpacing: "0.01em" }}>
        {today_concepts}/{daily_goal}
      </span>
      {streak_days >= 2 && (
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{streak_days}d streak</span>
      )}
    </Link>
  );
}

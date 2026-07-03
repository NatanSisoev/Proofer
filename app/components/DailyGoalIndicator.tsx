"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Snowflake } from "./Icons";

type Data = { today_concepts: number; streak_days: number; freezes_available: number; daily_goal: number };

export default function DailyGoalIndicator() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch("/api/today")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  const { today_concepts, streak_days, freezes_available, daily_goal } = data;
  const pct = Math.min(100, Math.round((today_concepts / daily_goal) * 100));
  const done = today_concepts >= daily_goal;
  const freezeNote = freezes_available > 0 ? ` · ${freezes_available} streak freeze${freezes_available !== 1 ? "s" : ""} banked` : "";

  return (
    <Link
      href="/session?mode=smart"
      title={`Start today's session — ${today_concepts}/${daily_goal} concepts done${streak_days > 0 ? ` · ${streak_days} day streak` : ""}${freezeNote}`}
      className="goal-pill"
      style={{ background: done ? "var(--green-soft)" : "var(--bg-soft)" }}
    >
      <div className="goal-pill-track">
        <div
          className="goal-pill-fill"
          style={{
            width: `${pct}%`,
            background: done ? "var(--green)" : "var(--accent-strong)",
          }}
        />
      </div>
      <span className="goal-pill-count" style={{ color: done ? "var(--green)" : "var(--muted)" }}>
        {today_concepts}/{daily_goal}
      </span>
      {streak_days >= 2 && (
        <span className="goal-pill-streak">{streak_days}d streak</span>
      )}
      {freezes_available > 0 && (
        <span className="goal-pill-streak icon-label" title={`${freezes_available} streak freeze${freezes_available !== 1 ? "s" : ""} banked`}>
          <Snowflake size={11} /> {freezes_available}
        </span>
      )}
    </Link>
  );
}

"use client";

import { useState } from "react";
import { Moon } from "./Icons";

export default function SnoozeButton({ nodeId }: { nodeId: string }) {
  const [snoozed, setSnoozed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function snooze() {
    setLoading(true);
    try {
      await fetch("/api/practice/snooze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, days: 2 }),
      });
      setSnoozed(true);
    } finally {
      setLoading(false);
    }
  }

  if (snoozed) {
    return <span className="muted small" style={{ fontSize: 11 }}>snoozed 2d</span>;
  }

  return (
    <button
      onClick={snooze}
      disabled={loading}
      title="Snooze 2 days"
      className="btn-snooze icon-label"
    >
      {loading ? "…" : <Moon size={12} />}
    </button>
  );
}

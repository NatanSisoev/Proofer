"use client";

import { useState } from "react";

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
      style={{
        background: "none", border: "none", cursor: "pointer",
        fontSize: 12, color: "var(--muted)", padding: "2px 6px",
        borderRadius: 5, lineHeight: 1,
      }}
    >
      {loading ? "…" : "zz"}
    </button>
  );
}

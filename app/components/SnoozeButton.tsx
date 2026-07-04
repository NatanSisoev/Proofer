"use client";

import { useState } from "react";
import { Moon, X } from "./Icons";
import { useTransientFlag } from "./useTransientFlag";

export default function SnoozeButton({ nodeId }: { nodeId: string }) {
  const [snoozed, setSnoozed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, raiseFailed] = useTransientFlag();

  async function snooze() {
    setLoading(true);
    try {
      const res = await fetch("/api/practice/snooze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, days: 2 }),
      });
      if (!res.ok) throw new Error();
      setSnoozed(true);
    } catch {
      raiseFailed();
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
      title={failed ? "Snooze failed — click to retry" : "Snooze 2 days"}
      className={`btn-snooze icon-label${failed ? " btn-failed" : ""}`}
    >
      {loading ? "…" : failed ? <X size={12} /> : <Moon size={12} />}
    </button>
  );
}

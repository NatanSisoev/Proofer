"use client";

import { useState } from "react";

export default function WeaknessDiagnosis({ nodeId, attemptCount }: { nodeId: string; attemptCount: number }) {
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (attemptCount < 2) return null;

  async function diagnose() {
    setLoading(true);
    try {
      const res = await fetch(`/api/node/${encodeURIComponent(nodeId)}/diagnose`);
      const data = await res.json();
      setDiagnosis(data.diagnosis || null);
    } finally {
      setLoading(false);
    }
  }

  if (diagnosis) {
    return (
      <div
        className="panel"
        style={{ borderColor: "#2a3a5a", background: "#0d1a2e", marginTop: 12 }}
      >
        <h2 style={{ color: "var(--accent)", marginBottom: 8 }}>AI diagnosis</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--text)" }}>{diagnosis}</p>
      </div>
    );
  }

  return (
    <button
      onClick={diagnose}
      disabled={loading}
      className="btn-ghost"
      style={{ fontSize: 12, marginTop: 8 }}
    >
      {loading ? "Diagnosing…" : `Diagnose why you keep struggling (${attemptCount} attempts)`}
    </button>
  );
}

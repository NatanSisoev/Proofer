"use client";

import { useState } from "react";
import Spinner from "./Spinner";

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
      <div className="panel diagnosis-panel">
        <h2 className="diagnosis-heading">AI diagnosis</h2>
        <p className="diagnosis-text">{diagnosis}</p>
      </div>
    );
  }

  return (
    <button
      onClick={diagnose}
      disabled={loading}
      className="btn-ghost diagnosis-btn"
    >
      {loading ? <Spinner label="Diagnosing…" /> : `Diagnose why you keep struggling (${attemptCount} attempts)`}
    </button>
  );
}

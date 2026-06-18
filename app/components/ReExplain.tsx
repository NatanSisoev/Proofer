"use client";

import { useState } from "react";
import Markdown from "./Markdown";

type Angle = "intuitive" | "formal" | "visual" | "historical" | "example";

const ANGLES: { value: Angle; label: string; emoji: string; desc: string }[] = [
  { value: "intuitive",  label: "Intuitive",  emoji: "💡", desc: "Plain language & analogies" },
  { value: "formal",     label: "Formal",     emoji: "📐", desc: "Rigorous & precise" },
  { value: "visual",     label: "Visual",     emoji: "🎨", desc: "Geometric & spatial" },
  { value: "historical", label: "Historical", emoji: "📜", desc: "Origin & motivation" },
  { value: "example",    label: "Example",    emoji: "🔢", desc: "Worked example first" },
];

export default function ReExplain({ nodeId }: { nodeId: string }) {
  const [angle, setAngle] = useState<Angle>("intuitive");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAngle, setLastAngle] = useState<Angle | null>(null);
  const [open, setOpen] = useState(false);

  async function generate(a: Angle) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setExplanation(null);
    setLastAngle(a);
    try {
      const res = await fetch("/api/node/reexplain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, angle: a }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setExplanation(data.explanation);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        className="btn-ghost btn-sm reexplain-trigger"
        onClick={() => { setOpen(true); generate("intuitive"); }}
      >
        ✨ Explain differently
      </button>
    );
  }

  return (
    <div className="inset-panel">
      <div className="panel-header">
        <span className="panel-label" style={{ color: "var(--accent)" }}>
          ✨ Explain differently
        </span>
        <button
          className="btn-ghost close-btn"
          onClick={() => setOpen(false)}
        >
          ✕
        </button>
      </div>

      {/* Angle selector */}
      <div className="angle-selector">
        {ANGLES.map((a) => (
          <button
            key={a.value}
            onClick={() => { setAngle(a.value); generate(a.value); }}
            disabled={busy}
            title={a.desc}
            className={`angle-btn${angle === a.value ? " active" : ""}`}
          >
            {a.emoji} {a.label}
          </button>
        ))}
      </div>

      {/* Output */}
      {busy && (
        <div className="muted small" style={{ padding: "12px 0" }}>
          Generating {lastAngle} explanation…
        </div>
      )}
      {error && (
        <div className="action-error" style={{ padding: "8px 0" }}>
          {error}
        </div>
      )}
      {explanation && !busy && (
        <div className="divider-top">
          <div className="panel-label label-xs" style={{ marginBottom: 8 }}>
            {ANGLES.find((a) => a.value === lastAngle)?.emoji}{" "}
            {ANGLES.find((a) => a.value === lastAngle)?.label} angle
          </div>
          <div className="markdown" style={{ fontSize: 14 }}>
            <Markdown>{explanation}</Markdown>
          </div>
          <button
            className="btn-ghost btn-sm"
            onClick={() => generate(angle)}
            disabled={busy}
            style={{ marginTop: 10 }}
          >
            ↻ Regenerate
          </button>
        </div>
      )}
    </div>
  );
}

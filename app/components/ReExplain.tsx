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
        className="btn-ghost"
        onClick={() => { setOpen(true); generate("intuitive"); }}
        style={{ fontSize: 13, color: "var(--accent)", marginTop: 12 }}
      >
        ✨ Explain differently
      </button>
    );
  }

  return (
    <div style={{ marginTop: 16, padding: "14px 16px", background: "var(--bg-soft)", borderRadius: 10, border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          ✨ Explain differently
        </span>
        <button
          className="btn-ghost"
          onClick={() => setOpen(false)}
          style={{ fontSize: 11, padding: "2px 8px", color: "var(--muted)" }}
        >
          ✕
        </button>
      </div>

      {/* Angle selector */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {ANGLES.map((a) => (
          <button
            key={a.value}
            onClick={() => { setAngle(a.value); generate(a.value); }}
            disabled={busy}
            title={a.desc}
            style={{
              padding: "5px 12px",
              borderRadius: 7,
              border: `1px solid ${angle === a.value ? "var(--accent)" : "var(--border)"}`,
              background: angle === a.value ? "var(--accent-soft)" : "var(--bg)",
              color: angle === a.value ? "var(--accent)" : "var(--muted)",
              fontSize: 12, cursor: "pointer", fontWeight: angle === a.value ? 600 : 400,
              transition: "all 0.15s",
            }}
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
        <div style={{ color: "var(--red)", fontSize: 13, padding: "8px 0" }}>
          {error}
        </div>
      )}
      {explanation && !busy && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <div
            className="muted small"
            style={{ marginBottom: 8, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}
          >
            {ANGLES.find((a) => a.value === lastAngle)?.emoji}{" "}
            {ANGLES.find((a) => a.value === lastAngle)?.label} angle
          </div>
          <div className="markdown" style={{ fontSize: 14 }}>
            <Markdown>{explanation}</Markdown>
          </div>
          <button
            className="btn-ghost"
            onClick={() => generate(angle)}
            disabled={busy}
            style={{ marginTop: 10, fontSize: 12 }}
          >
            ↻ Regenerate
          </button>
        </div>
      )}
    </div>
  );
}

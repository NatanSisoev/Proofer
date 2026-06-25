"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Spinner from "./Spinner";
import { Sparkles, X, RefreshCw, Lightbulb, Triangle, Palette, BookOpen, Hash } from "./Icons";
import ErrorBanner from "./ErrorBanner";
import type { ComponentType } from "react";

const Markdown = dynamic(() => import("./Markdown"));

type Angle = "intuitive" | "formal" | "visual" | "historical" | "example";

const ANGLES: { value: Angle; label: string; icon: ComponentType<{ size?: number }>; desc: string }[] = [
  { value: "intuitive",  label: "Intuitive",  icon: Lightbulb, desc: "Plain language & analogies" },
  { value: "formal",     label: "Formal",     icon: Triangle, desc: "Rigorous & precise" },
  { value: "visual",     label: "Visual",     icon: Palette, desc: "Geometric & spatial" },
  { value: "historical", label: "Historical", icon: BookOpen, desc: "Origin & motivation" },
  { value: "example",    label: "Example",    icon: Hash, desc: "Worked example first" },
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
        className="btn-ghost btn-sm reexplain-trigger icon-label"
        onClick={() => { setOpen(true); generate("intuitive"); }}
      >
        <Sparkles size={13} /> Explain differently
      </button>
    );
  }

  return (
    <div className="inset-panel">
      <div className="panel-header">
        <span className="panel-label icon-label" style={{ color: "var(--accent)" }}>
          <Sparkles size={13} /> Explain differently
        </span>
        <button
          className="btn-ghost close-btn"
          onClick={() => setOpen(false)}
        >
          <X size={13} />
        </button>
      </div>

      {/* Angle selector */}
      <div className="angle-selector">
        {ANGLES.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.value}
              onClick={() => { setAngle(a.value); generate(a.value); }}
              disabled={busy}
              title={a.desc}
              className={`angle-btn icon-label${angle === a.value ? " active" : ""}`}
            >
              <Icon size={13} /> {a.label}
            </button>
          );
        })}
      </div>

      {/* Output */}
      {busy && (
        <div className="muted small" style={{ padding: "12px 0" }}>
          <Spinner label={`Generating ${lastAngle} explanation…`} />
        </div>
      )}
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {explanation && !busy && (
        <div className="divider-top">
          <div className="panel-label label-xs icon-label" style={{ marginBottom: 8 }}>
            {(() => {
              const Icon = ANGLES.find((a) => a.value === lastAngle)?.icon;
              return Icon ? <Icon size={12} /> : null;
            })()}
            {ANGLES.find((a) => a.value === lastAngle)?.label} angle
          </div>
          <div className="markdown" style={{ fontSize: 14 }}>
            <Markdown>{explanation}</Markdown>
          </div>
          <button
            className="btn-ghost btn-sm icon-label"
            onClick={() => generate(angle)}
            disabled={busy}
            style={{ marginTop: 10 }}
          >
            <RefreshCw size={13} /> Regenerate
          </button>
        </div>
      )}
    </div>
  );
}

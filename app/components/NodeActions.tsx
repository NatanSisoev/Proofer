"use client";

import { useState } from "react";

type Props = {
  nodeId: string;
  nodePath: string | null;
  hasLLM: boolean;
};

type ImproveState = "idle" | "loading" | "preview" | "applying" | "done" | "error";

export default function NodeActions({ nodeId, nodePath, hasLLM }: Props) {
  const [improveState, setImproveState] = useState<ImproveState>("idle");
  const [preview, setPreview] = useState<string>("");
  const [error, setError] = useState<string>("");

  const obsidianHref = nodePath
    ? `obsidian://open?path=${encodeURIComponent(nodePath)}`
    : null;

  async function handleImprove() {
    setImproveState("loading");
    setError("");
    try {
      const res = await fetch(`/api/node/${encodeURIComponent(nodeId)}/improve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to improve note");
      setPreview(data.improved);
      setImproveState("preview");
    } catch (e: any) {
      setError(e.message);
      setImproveState("error");
    }
  }

  async function handleApply() {
    setImproveState("applying");
    try {
      const res = await fetch(`/api/node/${encodeURIComponent(nodeId)}/improve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true, content: preview }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to apply");
      }
      setImproveState("done");
    } catch (e: any) {
      setError(e.message);
      setImproveState("error");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {obsidianHref && (
          <a href={obsidianHref} className="btn-ghost" style={{ fontSize: 13 }}>
            Open in Obsidian ↗
          </a>
        )}
        {hasLLM && nodePath && (
          <button
            onClick={handleImprove}
            className="btn-ghost"
            style={{ fontSize: 13 }}
            disabled={improveState === "loading" || improveState === "applying"}
          >
            {improveState === "loading" ? "Thinking…" : "Improve with AI"}
          </button>
        )}
      </div>

      {improveState === "error" && (
        <p style={{ color: "var(--red)", fontSize: 13, margin: 0 }}>{error}</p>
      )}

      {improveState === "done" && (
        <p style={{ color: "var(--green)", fontSize: 13, margin: 0 }}>✓ Note updated in Obsidian. Re-sync vault to refresh the graph.</p>
      )}

      {improveState === "preview" && preview && (
        <div className="panel" style={{ marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>AI improvement preview</h2>
            <span className="muted small">Review before applying</span>
          </div>
          <pre style={{
            whiteSpace: "pre-wrap", fontSize: 12.5, lineHeight: 1.55,
            maxHeight: 500, overflow: "auto", background: "var(--bg)",
            padding: 14, borderRadius: 8, border: "1px solid var(--border)",
            fontFamily: "ui-monospace, monospace",
          }}>
            {preview}
          </pre>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={handleApply} className="btn-primary" style={{ fontSize: 13 }}>
              Apply to Obsidian
            </button>
            <button onClick={() => setImproveState("idle")} className="btn-ghost" style={{ fontSize: 13 }}>
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

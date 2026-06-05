"use client";

import { useState } from "react";

type Props = { nodeId: string; nodeTitle: string; nodeArea: string | null };

const TYPES = ["Definition", "Theorem", "Lemma", "Proposition", "Corollary", "Algorithm", "Example"];

export default function GhostCreate({ nodeId, nodeTitle, nodeArea }: Props) {
  const [type, setType] = useState("Definition");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [result, setResult] = useState<{ path?: string; obsidianHref?: string; error?: string } | null>(null);

  async function handleCreate() {
    setState("busy");
    const res = await fetch(`/api/node/${encodeURIComponent(nodeId)}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, area: nodeArea }),
    });
    const data = await res.json();
    setResult(data);
    setState(res.ok ? "done" : "error");
  }

  if (state === "done" && result?.obsidianHref) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
        <p style={{ color: "var(--green)", fontSize: 13, margin: 0 }}>✓ Note created</p>
        <a href={result.obsidianHref} className="btn-ghost" style={{ fontSize: 13 }}>Open in Obsidian ↗</a>
        <p className="muted small" style={{ margin: 0 }}>Sync vault after editing to refresh the graph.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="filter-btn"
          style={{ cursor: "pointer" }}
        >
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          onClick={handleCreate}
          disabled={state === "busy"}
          className="btn-ghost"
          style={{ fontSize: 13 }}
        >
          {state === "busy" ? "Creating…" : "Create note in Obsidian"}
        </button>
      </div>
      {state === "error" && result?.error && (
        <p style={{ color: "var(--red)", fontSize: 12, margin: 0 }}>{result.error}</p>
      )}
    </div>
  );
}

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
      <div className="ghost-actions">
        <p className="action-success">✓ Note created</p>
        <a href={result.obsidianHref} className="btn-ghost btn-sm">Open in Obsidian ↗</a>
        <p className="muted small" style={{ margin: 0 }}>Sync vault after editing to refresh the graph.</p>
      </div>
    );
  }

  return (
    <div className="ghost-actions">
      <div className="action-row" style={{ alignItems: "center" }}>
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
          className="btn-ghost btn-sm"
        >
          {state === "busy" ? "Creating…" : "Create note in Obsidian"}
        </button>
      </div>
      {state === "error" && result?.error && (
        <p className="error-inline" style={{ margin: 0 }}>{result.error}</p>
      )}
    </div>
  );
}

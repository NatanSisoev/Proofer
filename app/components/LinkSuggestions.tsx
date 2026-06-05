"use client";

import { useState } from "react";
import Link from "next/link";
import type { LinkSuggestion } from "@/lib/queries";

export default function LinkSuggestions({ initial }: { initial: LinkSuggestion[] }) {
  const [suggestions, setSuggestions] = useState(initial);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const key = (s: LinkSuggestion) => `${s.src_id}|${s.tgt_id}`;

  async function addLink(s: LinkSuggestion, type: string) {
    const k = key(s);
    setBusy(k);
    try {
      await fetch(`/api/node/${encodeURIComponent(s.src_id)}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: s.tgt_id, type }),
      });
      setAdded((prev) => new Set([...prev, k]));
    } finally {
      setBusy(null);
    }
  }

  function dismiss(s: LinkSuggestion) {
    setDismissed((prev) => new Set([...prev, key(s)]));
  }

  const visible = suggestions.filter((s) => !dismissed.has(key(s)));

  if (visible.length === 0) {
    return <p className="muted">No unlinked mentions found — your graph is well-connected!</p>;
  }

  return (
    <div>
      <p className="muted small" style={{ marginTop: 0, marginBottom: 16 }}>
        {visible.length} potential link{visible.length !== 1 ? "s" : ""} — concept names mentioned in notes without a graph edge.
        Add as <strong>related</strong> or dismiss each suggestion.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((s) => {
          const k = key(s);
          const isAdded = added.has(k);
          return (
            <div
              key={k}
              className="panel"
              style={{
                padding: "12px 14px",
                opacity: isAdded ? 0.5 : 1,
                borderColor: isAdded ? "var(--green)" : undefined,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>
                    <Link href={`/node/${encodeURIComponent(s.src_id)}`} style={{ fontWeight: 600 }}>
                      {s.src_title}
                    </Link>
                    {s.src_area && <span className="muted small"> · {s.src_area}</span>}
                    <span className="muted" style={{ margin: "0 6px" }}>mentions</span>
                    <Link href={`/node/${encodeURIComponent(s.tgt_id)}`} style={{ fontWeight: 600, color: "var(--accent)" }}>
                      {s.tgt_title}
                    </Link>
                    {s.tgt_area && <span className="muted small"> · {s.tgt_area}</span>}
                  </div>
                  <blockquote style={{
                    margin: 0, fontSize: 12, color: "var(--muted)",
                    borderLeft: "2px solid var(--border)", paddingLeft: 8,
                    fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {s.snippet}
                  </blockquote>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {isAdded ? (
                    <span style={{ color: "var(--green)", fontSize: 12 }}>✓ added</span>
                  ) : (
                    <>
                      <button
                        onClick={() => addLink(s, "related")}
                        disabled={busy === k}
                        style={{
                          fontSize: 11, padding: "3px 10px", borderRadius: 6,
                          background: "var(--accent-soft)", border: "1px solid var(--accent)",
                          color: "var(--accent)", cursor: "pointer",
                        }}
                      >
                        {busy === k ? "…" : "Add link"}
                      </button>
                      <button
                        onClick={() => dismiss(s)}
                        style={{
                          fontSize: 11, padding: "3px 8px", borderRadius: 6,
                          background: "transparent", border: "1px solid var(--border)",
                          color: "var(--muted)", cursor: "pointer",
                        }}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

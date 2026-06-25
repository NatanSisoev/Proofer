"use client";

import { useState } from "react";
import Link from "next/link";
import type { LinkSuggestion } from "@/lib/queries";
import { Check, X } from "./Icons";
import EmptyState from "./EmptyState";

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
    return <EmptyState icon={<Check size={18} />}>No unlinked mentions found — your graph is well-connected!</EmptyState>;
  }

  return (
    <div>
      <p className="muted small section-intro">
        {visible.length} potential link{visible.length !== 1 ? "s" : ""} — concept names mentioned in notes without a graph edge.
        Add as <strong>related</strong> or dismiss each suggestion.
      </p>
      <div className="suggestions-list">
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
              <div className="link-suggestion-row">
                <div className="flex-fill">
                  <div className="link-suggestion-desc">
                    <Link href={`/node/${encodeURIComponent(s.src_id)}`} style={{ fontWeight: 600 }}>
                      {s.src_title}
                    </Link>
                    {s.src_area && <span className="muted small"> · {s.src_area}</span>}
                    <span className="muted" style={{ margin: "0 6px" }}>mentions</span>
                    <Link href={`/node/${encodeURIComponent(s.tgt_id)}`} className="link-suggestion-tgt">
                      {s.tgt_title}
                    </Link>
                    {s.tgt_area && <span className="muted small"> · {s.tgt_area}</span>}
                  </div>
                  <blockquote className="quote-snippet">
                    {s.snippet}
                  </blockquote>
                </div>
                <div className="item-actions">
                  {isAdded ? (
                    <span className="link-added-badge icon-label"><Check size={12} /> added</span>
                  ) : (
                    <>
                      <button
                        onClick={() => addLink(s, "related")}
                        disabled={busy === k}
                        className="add-link-btn"
                      >
                        {busy === k ? "…" : "Add link"}
                      </button>
                      <button
                        onClick={() => dismiss(s)}
                        className="dismiss-btn"
                      >
                        <X size={12} />
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

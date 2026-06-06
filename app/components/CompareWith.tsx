"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Markdown from "./Markdown";

type SearchResult = { id: string; title: string; type: string | null; area: string | null; mastery_p: number };

export default function CompareWith({ nodeId, nodeTitle }: { nodeId: string; nodeTitle: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [comparison, setComparison] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live search
  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=8`);
        const data: SearchResult[] = await res.json();
        // Exclude self
        setResults(data.filter((r) => r.id !== nodeId));
      } catch { setResults([]); }
    }, 120);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query, nodeId]);

  async function compare(other: SearchResult) {
    setSelected(other);
    setResults([]);
    setQuery("");
    setComparison(null);
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/node/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeIdA: nodeId, nodeIdB: other.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setComparison(data.comparison);
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
        onClick={() => setOpen(true)}
        style={{ fontSize: 13, marginTop: 8 }}
      >
        ⚖ Compare with…
      </button>
    );
  }

  return (
    <div style={{ marginTop: 16, padding: "14px 16px", background: "var(--bg-soft)", borderRadius: 10, border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          ⚖ Compare {nodeTitle} with…
        </span>
        <button
          className="btn-ghost"
          onClick={() => { setOpen(false); setSelected(null); setComparison(null); setError(null); }}
          style={{ fontSize: 11, padding: "2px 8px", color: "var(--muted)" }}
        >
          ✕
        </button>
      </div>

      {/* Search input */}
      {!selected && (
        <div style={{ position: "relative" }}>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for another concept…"
            className="search-box"
            style={{ fontSize: 13, padding: "8px 12px" }}
          />
          {results.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
              background: "var(--panel)", border: "1px solid var(--border)",
              borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: "auto",
            }}>
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => compare(r)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "8px 12px", background: "none", border: "none",
                    cursor: "pointer", textAlign: "left", color: "var(--text)",
                    borderBottom: "1px solid var(--border)",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = "var(--bg-soft)")}
                  onMouseOut={(e) => (e.currentTarget.style.background = "none")}
                >
                  {r.type && (
                    <span className={`type-badge t-${r.type}`} style={{ flexShrink: 0 }}>{r.type}</span>
                  )}
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>
                    {r.title}
                  </span>
                  {r.area && <span className="muted small" style={{ flexShrink: 0, fontSize: 11 }}>{r.area}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected + loading */}
      {selected && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="muted small">Comparing</span>
            <strong>{nodeTitle}</strong>
            <span className="muted small">vs</span>
            <Link href={`/node/${encodeURIComponent(selected.id)}`} style={{ fontWeight: 600 }}>
              {selected.title}
            </Link>
            <button
              className="btn-ghost"
              onClick={() => { setSelected(null); setComparison(null); setError(null); }}
              style={{ fontSize: 11, padding: "2px 6px", marginLeft: 4, color: "var(--muted)" }}
            >
              change
            </button>
          </div>
        </div>
      )}

      {busy && <div className="muted small" style={{ padding: "8px 0" }}>Generating comparison…</div>}
      {error && <div style={{ color: "var(--red)", fontSize: 13 }}>{error}</div>}

      {comparison && !busy && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <div className="markdown" style={{ fontSize: 13.5 }}>
            <Markdown>{comparison}</Markdown>
          </div>
          <button
            className="btn-ghost"
            onClick={() => { setSelected(null); setComparison(null); setError(null); setQuery(""); }}
            style={{ marginTop: 10, fontSize: 12 }}
          >
            Compare with another →
          </button>
        </div>
      )}
    </div>
  );
}

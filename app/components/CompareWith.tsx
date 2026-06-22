"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import Spinner from "./Spinner";
import { Scale, X } from "./Icons";

const Markdown = dynamic(() => import("./Markdown"));

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
        className="btn-ghost btn-sm icon-label"
        onClick={() => setOpen(true)}
        style={{ marginTop: 8 }}
      >
        <Scale size={13} /> Compare with…
      </button>
    );
  }

  return (
    <div className="inset-panel">
      <div className="panel-header">
        <span className="panel-label icon-label">
          <Scale size={13} /> Compare {nodeTitle} with…
        </span>
        <button
          className="btn-ghost close-btn"
          onClick={() => { setOpen(false); setSelected(null); setComparison(null); setError(null); }}
        >
          <X size={13} />
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
            className="search-box compare-search-input"
          />
          {results.length > 0 && (
            <div className="search-dropdown">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => compare(r)}
                  className="search-dropdown-item"
                >
                  {r.type && (
                    <span className={`type-badge t-${r.type}`} style={{ flexShrink: 0 }}>{r.type}</span>
                  )}
                  <span className="item-title">
                    {r.title}
                  </span>
                  {r.area && <span className="muted small">{r.area}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected + loading */}
      {selected && (
        <div style={{ marginBottom: 10 }}>
          <div className="compare-header">
            <span className="muted small">Comparing</span>
            <strong>{nodeTitle}</strong>
            <span className="muted small">vs</span>
            <Link href={`/node/${encodeURIComponent(selected.id)}`} style={{ fontWeight: 600 }}>
              {selected.title}
            </Link>
            <button
              className="btn-ghost close-btn"
              onClick={() => { setSelected(null); setComparison(null); setError(null); }}
              style={{ marginLeft: 4 }}
            >
              change
            </button>
          </div>
        </div>
      )}

      {busy && <div className="muted small" style={{ padding: "8px 0" }}><Spinner label="Generating comparison…" /></div>}
      {error && <div className="action-error">{error}</div>}

      {comparison && !busy && (
        <div className="divider-top">
          <div className="markdown" style={{ fontSize: 13.5 }}>
            <Markdown>{comparison}</Markdown>
          </div>
          <button
            className="btn-ghost btn-sm"
            onClick={() => { setSelected(null); setComparison(null); setError(null); setQuery(""); }}
            style={{ marginTop: 10 }}
          >
            Compare with another →
          </button>
        </div>
      )}
    </div>
  );
}

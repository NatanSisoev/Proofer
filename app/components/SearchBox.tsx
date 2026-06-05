"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

type Hit = {
  id: string; title: string; type: string | null;
  area: string | null; overview: string | null; mastery_p: number;
};

export default function SearchBox() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); setCursor(-1); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        setHits(await res.json());
        setCursor(-1);
      } catch { /* aborted */ }
    }, 100);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  function onKey(e: React.KeyboardEvent) {
    if (hits.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, -1)); }
    if (e.key === "Enter" && cursor >= 0) {
      window.location.href = `/node/${encodeURIComponent(hits[cursor].id)}`;
    }
    if (e.key === "Escape") { setQ(""); setHits([]); }
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        className="search-box"
        placeholder="Search concepts… (e.g. compact, Hilbert, measure)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKey}
        autoFocus
        autoComplete="off"
      />
      {hits.length > 0 && (
        <div className="search-results panel" style={{ marginTop: 6, position: "absolute", width: "100%", zIndex: 50 }}>
          {hits.map((h, i) => (
            <Link
              key={h.id}
              href={`/node/${encodeURIComponent(h.id)}`}
              className={i === cursor ? "search-hit active" : "search-hit"}
              onClick={() => { setQ(""); setHits([]); }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                <span className={`type-badge t-${h.type || "ghost"}`}>{h.type || "?"}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {h.title}
                </span>
                {h.area && <span className="muted small" style={{ flexShrink: 0 }}>{h.area}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <div className="bar" style={{ width: 48 }}>
                  <span style={{ width: `${Math.round(h.mastery_p * 100)}%` }} />
                </div>
                <span className="small muted">{Math.round(h.mastery_p * 100)}%</span>
              </div>
            </Link>
          ))}
          <p className="muted small" style={{ padding: "6px 10px 4px", margin: 0 }}>
            ↑↓ navigate · Enter to open · Esc to close
          </p>
        </div>
      )}
    </div>
  );
}

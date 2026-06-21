"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Hit = {
  id: string;
  title: string;
  type: string | null;
  area: string | null;
  overview: string | null;
  mastery_p: number;
  direct_unmastered_prereqs: number;
};

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setHits([]);
    setCursor(-1);
  }, []);

  // Open on / or s keydown (not in an input)
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement).isContentEditable;
      if (inInput) return;
      if (e.key === "/" || (e.key === "s" && !e.metaKey && !e.ctrlKey)) {
        // Only open global if no local .search-box is on the page
        const local = document.querySelector<HTMLInputElement>(".search-box");
        if (local) { e.preventDefault(); local.focus(); return; }
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Live search
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
    if (e.key === "Escape") { close(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, -1)); }
    if (e.key === "Enter") {
      if (cursor >= 0 && hits[cursor]) {
        router.push(`/node/${encodeURIComponent(hits[cursor].id)}`);
        close();
      }
    }
  }

  if (!open) return null;

  return (
    <div className="global-search-overlay" onClick={close}>
      <div className="global-search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="global-search-header">
          <span className="global-search-icon">⌕</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search concepts… (e.g. compact, Hilbert, group)"
            autoComplete="off"
            className="global-search-input"
          />
          <kbd className="kbd" onClick={close}>Esc</kbd>
        </div>

        {hits.length > 0 && (
          <div className="global-search-results">
            {hits.map((h, i) => (
              <Link
                key={h.id}
                href={`/node/${encodeURIComponent(h.id)}`}
                onClick={close}
                className="global-search-hit"
                style={{ background: i === cursor ? "var(--accent-soft)" : "transparent" }}
              >
                <div className="global-search-hit-inner">
                  {h.type && <span className={`type-badge t-${h.type}`}>{h.type}</span>}
                  <div className="global-search-hit-text">
                    <div className="global-search-hit-title">{h.title}</div>
                    {h.overview && (
                      <div className="global-search-hit-overview muted small">
                        {h.overview.slice(0, 80)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="global-search-hit-meta">
                  {h.area && <span className="muted small">{h.area}</span>}
                  {h.mastery_p >= 0.8 ? (
                    <span className="pill search-pill-mastered">mastered</span>
                  ) : h.direct_unmastered_prereqs === 0 ? (
                    <span className="pill search-pill-ready">ready</span>
                  ) : (
                    <span className="pill search-pill-prereqs" title="Unmastered direct prerequisites">
                      {h.direct_unmastered_prereqs} prereq{h.direct_unmastered_prereqs !== 1 ? "s" : ""}
                    </span>
                  )}
                  <div className="bar" style={{ width: 40 }}>
                    <span style={{ width: `${Math.round(h.mastery_p * 100)}%` }} />
                  </div>
                  <span className="muted small global-search-hit-pct">
                    {Math.round(h.mastery_p * 100)}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {q.trim().length >= 2 && hits.length === 0 && (
          <div className="global-search-empty muted">
            No results for &ldquo;{q}&rdquo;
          </div>
        )}

        {q.trim().length < 2 && (
          <div className="global-search-hint muted small">
            Type at least 2 characters · ↑↓ navigate · Enter to open
          </div>
        )}
      </div>
    </div>
  );
}

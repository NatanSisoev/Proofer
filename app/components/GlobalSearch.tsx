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
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "10vh",
      }}
      onClick={close}
    >
      <div
        style={{
          width: "min(640px, 90vw)",
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)", gap: 10 }}>
          <span style={{ color: "var(--muted)", fontSize: 16 }}>🔍</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search concepts… (e.g. compact, Hilbert, group)"
            autoComplete="off"
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontSize: 16, color: "var(--text)",
            }}
          />
          <kbd
            onClick={close}
            style={{
              background: "var(--bg-soft)", border: "1px solid var(--border)",
              borderRadius: 5, padding: "2px 7px", fontSize: 12,
              color: "var(--muted)", cursor: "pointer",
            }}
          >
            Esc
          </kbd>
        </div>

        {hits.length > 0 && (
          <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
            {hits.map((h, i) => (
              <Link
                key={h.id}
                href={`/node/${encodeURIComponent(h.id)}`}
                onClick={close}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 16px", textDecoration: "none",
                  background: i === cursor ? "var(--accent-soft)" : "transparent",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  {h.type && <span className={`type-badge t-${h.type}`}>{h.type}</span>}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>
                      {h.title}
                    </div>
                    {h.overview && (
                      <div className="muted small" style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {h.overview.slice(0, 80)}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {h.area && <span className="muted small" style={{ fontSize: 11 }}>{h.area}</span>}
                  <div className="bar" style={{ width: 40 }}>
                    <span style={{ width: `${Math.round(h.mastery_p * 100)}%` }} />
                  </div>
                  <span className="muted small" style={{ fontSize: 11, width: 26, textAlign: "right" }}>
                    {Math.round(h.mastery_p * 100)}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {q.trim().length >= 2 && hits.length === 0 && (
          <div className="muted" style={{ padding: "16px", textAlign: "center", fontSize: 14 }}>
            No results for &ldquo;{q}&rdquo;
          </div>
        )}

        {q.trim().length < 2 && (
          <div className="muted small" style={{ padding: "12px 16px", fontSize: 12 }}>
            Type at least 2 characters · ↑↓ navigate · Enter to open
          </div>
        )}
      </div>
    </div>
  );
}

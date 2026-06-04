"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Hit = { id: string; title: string; type: string | null; area: string | null; overview: string | null };

export default function SearchBox() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        setHits(await res.json());
      } catch {
        /* aborted */
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  return (
    <div>
      <input
        className="search-box"
        placeholder="Search concepts…  (e.g. compact, Hilbert, measure)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      {hits.length > 0 && (
        <div className="search-results panel" style={{ marginTop: 8 }}>
          {hits.map((h) => (
            <Link key={h.id} href={`/node/${encodeURIComponent(h.id)}`}>
              <span className={`type-badge t-${h.type || "ghost"}`} style={{ marginRight: 8 }}>
                {h.type || "?"}
              </span>
              {h.title}
              {h.area && <span className="muted small"> · {h.area}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

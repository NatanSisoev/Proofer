"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import StudyQueue from "./StudyQueue";

type QueueNode = { id: string; title: string; type: string | null; area: string | null; mastery_p?: number };

type Mode = "smart" | "due" | "weak" | "area" | "bookmarks" | "custom";

const MODES: { key: Mode; label: string; desc: string }[] = [
  { key: "smart", label: "Smart", desc: "Due reviews first, then your frontier, then weak spots" },
  { key: "due", label: "Due for review", desc: "Concepts whose mastery is decaying — review them now" },
  { key: "weak", label: "Weak spots", desc: "Practiced but still below mastery threshold" },
  { key: "bookmarks", label: "★ Bookmarked", desc: "Drill your starred concepts" },
  { key: "area", label: "By topic", desc: "Focus on one area" },
  { key: "custom",    label: "Custom",        desc: "Hand-pick the concepts to practice" },
];

type ModeCounts = { due: number; weak: number; frontier: number; bookmarks: number };
type ProblemKind = "any" | "compute" | "prove" | "counterexample" | "explain";
const KIND_OPTIONS: { key: ProblemKind; label: string; desc: string }[] = [
  { key: "any",           label: "Any",          desc: "Mix of all problem types" },
  { key: "prove",         label: "Prove",         desc: "Formal proofs and derivations" },
  { key: "compute",       label: "Compute",       desc: "Calculations and worked examples" },
  { key: "explain",       label: "Explain",       desc: "State definitions and intuitions" },
  { key: "counterexample",label: "Counter",        desc: "Find a counterexample" },
];

export default function SessionSetup({
  areas,
  initialMode = "smart",
  initialArea = "",
}: {
  areas: string[];
  initialMode?: Mode;
  initialArea?: string;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [area, setArea] = useState<string>(initialArea || areas[0] || "");
  const [count, setCount] = useState(5);
  const [preferKind, setPreferKind] = useState<ProblemKind>("any");
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<QueueNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<QueueNode[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [counts, setCounts] = useState<ModeCounts | null>(null);
  // Custom mode
  const [customSearch, setCustomSearch] = useState("");
  const [customResults, setCustomResults] = useState<QueueNode[]>([]);
  const [customPicked, setCustomPicked] = useState<QueueNode[]>([]);
  const customDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/session/stats").then((r) => r.json()).then(setCounts).catch(() => {});
  }, []);

  // Custom mode: live concept search
  useEffect(() => {
    if (mode !== "custom") return;
    if (!customSearch.trim() || customSearch.length < 2) { setCustomResults([]); return; }
    if (customDebounce.current) clearTimeout(customDebounce.current);
    customDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(customSearch)}&limit=8`);
        const data: QueueNode[] = await res.json();
        const pickedIds = new Set(customPicked.map(p => p.id));
        setCustomResults(data.filter(d => !pickedIds.has(d.id)));
      } catch { setCustomResults([]); }
    }, 120);
    return () => { if (customDebounce.current) clearTimeout(customDebounce.current); };
  }, [customSearch, mode, customPicked]);

  const loadPreview = useCallback(async () => {
    if (mode === "custom") { setPreview(customPicked); return; }
    setPreviewLoading(true);
    try {
      const params = new URLSearchParams({ mode, limit: String(count) });
      if (mode === "area" && area) params.set("area", area);
      const res = await fetch(`/api/session/queue?${params}`);
      const data = await res.json();
      setPreview(data.queue ?? []);
    } catch {
      setPreview([]);
    } finally {
      setPreviewLoading(false);
    }
  }, [mode, area, count, customPicked]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  async function start() {
    setError(null);
    // Custom mode: use hand-picked list directly
    if (mode === "custom") {
      if (!customPicked.length) { setError("Add at least one concept to your custom list."); return; }
      setQueue(customPicked);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ mode, limit: String(count) });
      if (mode === "area" && area) params.set("area", area);
      const res = await fetch(`/api/session/queue?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to build queue");
      if (!data.queue?.length) {
        setError("No concepts found for this mode. Try a different option.");
        return;
      }
      setQueue(data.queue);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (queue) {
    return <StudyQueue queue={queue} preferKind={preferKind === "any" ? undefined : preferKind} />;
  }

  return (
    <div className="grid" style={{ gap: 20 }}>
      {/* Left: config */}
      <div>
        <div className="panel" style={{ marginBottom: 16 }}>
          <h2>Session mode</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {MODES.map((m) => {
              const modeCount = counts
                ? m.key === "due" ? counts.due
                  : m.key === "weak" ? counts.weak
                  : m.key === "smart" ? counts.frontier + counts.due
                  : m.key === "bookmarks" ? counts.bookmarks
                  : null
                : null;
              const isEmpty = modeCount === 0;
              return (
              <label
                key={m.key}
                className={`mode-option${mode === m.key ? " active" : ""}${isEmpty ? " empty" : ""}`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={m.key}
                  checked={mode === m.key}
                  onChange={() => setMode(m.key)}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{m.label}</span>
                    {modeCount !== null && (
                      <span className="pill" style={{
                        fontSize: 11,
                        color: isEmpty ? "var(--muted)" : m.key === "due" ? "var(--amber)" : "var(--accent)",
                      }}>
                        {modeCount}
                      </span>
                    )}
                  </div>
                  <div className="muted small">{m.desc}</div>
                </div>
              </label>
              );
            })}
          </div>

          {mode === "area" && (
            <div style={{ marginTop: 14 }}>
              <label className="muted small" style={{ display: "block", marginBottom: 6 }}>Area</label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                style={{ width: "100%" }}
              >
                {areas.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}

          {mode === "custom" && (
            <div style={{ marginTop: 14 }}>
              <label className="muted small" style={{ display: "block", marginBottom: 6 }}>
                Add concepts ({customPicked.length} selected)
              </label>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input
                  type="text"
                  value={customSearch}
                  onChange={e => setCustomSearch(e.target.value)}
                  placeholder="Search concepts to add…"
                  className="search-box"
                  style={{ fontSize: 13, padding: "7px 12px" }}
                />
                {customResults.length > 0 && (
                  <div className="search-dropdown">
                    {customResults.map(r => (
                      <button
                        key={r.id}
                        className="search-dropdown-item"
                        onClick={() => {
                          setCustomPicked(p => [...p, r]);
                          setCustomResults(prev => prev.filter(x => x.id !== r.id));
                          setCustomSearch("");
                        }}
                      >
                        {r.type && <span className={`type-badge t-${r.type}`} style={{ flexShrink: 0 }}>{r.type}</span>}
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                        {r.area && <span className="muted small" style={{ fontSize: 11 }}>{r.area}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {customPicked.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {customPicked.map(c => (
                    <div key={c.id} className="selected-chip">
                      <span>{c.title}</span>
                      <button onClick={() => setCustomPicked(p => p.filter(x => x.id !== c.id))}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {customPicked.length === 0 && (
                <p className="muted small" style={{ marginTop: 4 }}>Search above and click to add concepts.</p>
              )}
            </div>
          )}
        </div>

        {mode !== "custom" && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <h2>Session length</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {[3, 5, 8, 10, 15, 20].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={count === n ? "btn-primary" : "btn-ghost"}
                style={{ minWidth: 44 }}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="muted small" style={{ marginTop: 8, marginBottom: 0 }}>
            {count} concept{count !== 1 ? "s" : ""} · ~{count * 3}–{count * 5} min
          </p>
        </div>
        )}

        <div className="panel" style={{ marginBottom: 16 }}>
          <h2>Problem type</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {KIND_OPTIONS.map((k) => (
              <label
                key={k.key}
                className={`mode-option-sm${preferKind === k.key ? " active" : ""}`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k.key}
                  checked={preferKind === k.key}
                  onChange={() => setPreferKind(k.key)}
                />
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{k.label}</span>
                  <span className="muted small" style={{ marginLeft: 8 }}>{k.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="panel" style={{ color: "var(--red)", marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button
          className="btn-primary"
          onClick={start}
          disabled={loading || (mode === "custom" ? customPicked.length === 0 : preview.length === 0)}
          style={{ padding: "10px 28px", fontSize: 15, width: "100%" }}
        >
          {loading ? "Building queue…" : mode === "custom"
            ? `Start with ${customPicked.length} concept${customPicked.length !== 1 ? "s" : ""} →`
            : "Start session →"}
        </button>
      </div>

      {/* Right: queue preview */}
      <div className="panel">
        <h2>
          {mode === "custom" ? "Your custom queue" : "Queue preview"}
          {previewLoading && mode !== "custom" && <span className="muted small" style={{ marginLeft: 8, fontWeight: 400 }}>loading…</span>}
        </h2>
        {!previewLoading && preview.length === 0 && mode !== "custom" && (
          <p className="muted">No concepts found for this mode.</p>
        )}
        {mode === "custom" && customPicked.length === 0 && (
          <p className="muted small">Use the search on the left to pick concepts.</p>
        )}
        {preview.map((n, i) => (
          <div key={n.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "7px 4px", borderBottom: "1px solid var(--border)",
          }}>
            <span className="muted small" style={{ width: 18, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
            {n.type && <span className={`type-badge t-${n.type}`}>{n.type}</span>}
            <Link
              href={`/node/${encodeURIComponent(n.id)}`}
              target="_blank"
              style={{ color: "var(--text)", fontSize: 13.5, flex: 1, minWidth: 0 }}
            >
              {n.title}
            </Link>
            {n.area && <span className="muted small" style={{ flexShrink: 0 }}>{n.area}</span>}
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <div className="bar" style={{ width: 36, height: 5 }}>
                <span style={{ width: `${Math.round((n.mastery_p ?? 0) * 100)}%` }} />
              </div>
              <span className="muted small" style={{ fontSize: 11, width: 28, textAlign: "right" }}>
                {Math.round((n.mastery_p ?? 0) * 100)}%
              </span>
            </div>
          </div>
        ))}
        {preview.length > 0 && (
          <p className="muted small" style={{ marginTop: 10, marginBottom: 0 }}>
            Click any concept to preview it · queue shuffles on start
          </p>
        )}
      </div>
    </div>
  );
}

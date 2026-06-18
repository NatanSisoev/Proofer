"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import StudyQueue, { SESSION_KEY, type SavedSession } from "./StudyQueue";

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
  const [savedSession, setSavedSession] = useState<SavedSession | null>(null);
  const [resumeData, setResumeData] = useState<SavedSession | null>(null);
  // Custom mode
  const [customSearch, setCustomSearch] = useState("");
  const [customResults, setCustomResults] = useState<QueueNode[]>([]);
  const [customPicked, setCustomPicked] = useState<QueueNode[]>([]);
  const customDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/session/stats").then((r) => r.json()).then(setCounts).catch(() => {});
    try {
      const s = localStorage.getItem(SESSION_KEY);
      if (s) setSavedSession(JSON.parse(s));
    } catch {}
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
    return <StudyQueue queue={queue} preferKind={preferKind === "any" ? undefined : preferKind} savedState={resumeData} />;
  }

  return (
    <>
      {savedSession && (
        <div className="panel resume-banner">
          <div>
            <strong>Unfinished session</strong>
            <p className="muted small" style={{ margin: 0 }}>
              {Object.keys(savedSession.resultsByIndex ?? {}).length} of {savedSession.activeQueue.length} concepts answered
            </p>
          </div>
          <div className="resume-actions">
            <button
              className="btn-primary"
              onClick={() => {
                setQueue(savedSession.activeQueue);
                setResumeData(savedSession);
                setSavedSession(null);
              }}
            >
              Resume →
            </button>
            <button
              className="btn-ghost btn-sm"
              onClick={() => {
                try { localStorage.removeItem(SESSION_KEY); } catch {}
                setSavedSession(null);
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    <div className="grid" style={{ gap: 20 }}>
      {/* Left: config */}
      <div>
        <div className="panel" style={{ marginBottom: 16 }}>
          <h2>Session mode</h2>
          <div className="mode-list">
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
                <div className="mode-body">
                  <div className="mode-label-row">
                    <span className="mode-label-text">{m.label}</span>
                    {modeCount !== null && (
                      <span className="pill pill-sm" style={{
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
              <label className="muted small field-label">Area</label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="form-input"
              >
                {areas.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}

          {mode === "custom" && (
            <div style={{ marginTop: 14 }}>
              <label className="muted small field-label">
                Add concepts ({customPicked.length} selected)
              </label>
              <div className="search-wrapper">
                <input
                  type="text"
                  value={customSearch}
                  onChange={e => setCustomSearch(e.target.value)}
                  placeholder="Search concepts to add…"
                  className="search-box search-sm"
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
                        {r.type && <span className={`type-badge t-${r.type}`}>{r.type}</span>}
                        <span className="item-title">{r.title}</span>
                        {r.area && <span className="muted small" style={{ fontSize: 11 }}>{r.area}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {customPicked.length > 0 && (
                <div className="chips-row">
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
          <div className="btn-row">
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
          <p className="muted small field-hint">
            {count} concept{count !== 1 ? "s" : ""} · ~{count * 3}–{count * 5} min
          </p>
        </div>
        )}

        <div className="panel" style={{ marginBottom: 16 }}>
          <h2>Problem type</h2>
          <div className="mode-list" style={{ gap: 6 }}>
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
                  <span className="kind-label">{k.label}</span>
                  <span className="muted small kind-desc">{k.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="panel error-notice" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button
          className="btn-primary btn-full"
          onClick={start}
          disabled={loading || (mode === "custom" ? customPicked.length === 0 : preview.length === 0)}
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
          {previewLoading && mode !== "custom" && <span className="muted small loading-tag">loading…</span>}
        </h2>
        {!previewLoading && preview.length === 0 && mode !== "custom" && (
          <p className="muted">No concepts found for this mode.</p>
        )}
        {mode === "custom" && customPicked.length === 0 && (
          <p className="muted small">Use the search on the left to pick concepts.</p>
        )}
        {preview.map((n, i) => (
          <div key={n.id} className="session-result-row">
            <span className="muted small row-index">{i + 1}</span>
            {n.type && <span className={`type-badge t-${n.type}`}>{n.type}</span>}
            <Link
              href={`/node/${encodeURIComponent(n.id)}`}
              target="_blank"
              className="preview-link"
            >
              {n.title}
            </Link>
            {n.area && <span className="muted small" style={{ flexShrink: 0 }}>{n.area}</span>}
            <div className="preview-mastery">
              <div className="bar bar-mini">
                <span style={{ width: `${Math.round((n.mastery_p ?? 0) * 100)}%` }} />
              </div>
              <span className="muted small preview-pct">
                {Math.round((n.mastery_p ?? 0) * 100)}%
              </span>
            </div>
          </div>
        ))}
        {preview.length > 0 && (
          <p className="muted small panel-tip">
            Click any concept to preview it · queue shuffles on start
          </p>
        )}
      </div>
    </div>
    </>
  );
}

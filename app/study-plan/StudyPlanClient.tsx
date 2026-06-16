"use client";

import { useState } from "react";
import Markdown from "@/app/components/Markdown";

type AreaStat = { area: string; total: number; mastered: number; avg_p: number; practiced: number };

export default function StudyPlanClient({
  areas,
  areaStats,
}: {
  areas: string[];
  areaStats: AreaStat[];
}) {
  // Default to 4 weeks from today
  const defaultDate = new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10);
  const [targetDate, setTargetDate] = useState(defaultDate);
  const [focusArea, setFocusArea] = useState("");
  const [plan, setPlan] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const daysLeft = Math.ceil((new Date(targetDate).getTime() - Date.now()) / 86400000);

  async function generate() {
    setBusy(true);
    setError(null);
    setPlan(null);
    try {
      const res = await fetch("/api/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDate, focusArea: focusArea || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate plan");
      setPlan(data.plan);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 20, marginTop: 20 }}>
      <div>
        {/* Config panel */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <h2>Configure your plan</h2>

          <div style={{ marginBottom: 16 }}>
            <label className="muted small field-label">
              Target date (exam / deadline)
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
              className="form-input"
              style={{ colorScheme: "dark" }}
            />
            {daysLeft > 0 && (
              <p className="muted small" style={{ marginTop: 6, marginBottom: 0 }}>
                {daysLeft} day{daysLeft !== 1 ? "s" : ""} away (~{Math.ceil(daysLeft / 7)} week{Math.ceil(daysLeft / 7) !== 1 ? "s" : ""})
              </p>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="muted small field-label">
              Focus area (optional)
            </label>
            <select
              value={focusArea}
              onChange={e => setFocusArea(e.target.value)}
              className="form-input"
            >
              <option value="">All areas</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <button
            className="btn-primary btn-full btn-lg"
            onClick={generate}
            disabled={busy || daysLeft <= 0}
          >
            {busy ? "Generating plan…" : "Generate study plan →"}
          </button>

          {error && <p className="action-error" style={{ marginTop: 10 }}>{error}</p>}
        </div>

        {/* Weak areas summary */}
        {areaStats.length > 0 && (
          <div className="panel">
            <h2>Current mastery by area</h2>
            {areaStats.map(a => (
              <div key={a.area} style={{ marginBottom: 8 }}>
                <div className="area-stat-row">
                  <span style={{ fontWeight: 500 }}>{a.area}</span>
                  <span className="muted small">{a.mastered}/{a.total} · {Math.round(a.avg_p * 100)}%</span>
                </div>
                <div className="bar" style={{ height: 5 }}>
                  <span style={{
                    width: `${Math.round(a.avg_p * 100)}%`,
                    background: a.avg_p >= 0.8 ? "var(--green)" : a.avg_p >= 0.4 ? "var(--accent)" : "var(--red)",
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        {busy && (
          <div className="panel center-panel">
            <div className="muted">Generating your personalised study plan…</div>
            <div className="muted small" style={{ marginTop: 8 }}>This takes ~10–15 seconds</div>
          </div>
        )}

        {plan && !busy && (
          <div className="panel">
            <div className="panel-header" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Your study plan</h2>
              <button
                className="btn-ghost"
                style={{ fontSize: 12 }}
                onClick={() => { setPlan(null); }}
              >
                ✕ clear
              </button>
            </div>
            <div className="markdown">
              <Markdown>{plan}</Markdown>
            </div>
            <div className="regen-row">
              <button className="btn-ghost btn-sm" onClick={generate}>
                ↻ Regenerate
              </button>
            </div>
          </div>
        )}

        {!plan && !busy && (
          <div className="panel center-panel" style={{ background: "var(--bg-soft)" }}>
            <div className="muted" style={{ fontSize: 14 }}>
              Set your target date and click <strong>Generate study plan</strong> to get a personalised schedule.
            </div>
            <p className="muted small" style={{ marginTop: 8 }}>
              The plan uses your current mastery data to prioritise weak areas and unmastered concepts.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

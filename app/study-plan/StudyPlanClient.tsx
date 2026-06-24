"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Spinner from "@/app/components/Spinner";
import { ArrowRight, X, RefreshCw } from "@/app/components/Icons";
import ErrorBanner from "@/app/components/ErrorBanner";

const Markdown = dynamic(() => import("@/app/components/Markdown"));

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
    <div className="grid study-plan-grid">
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
            />
            {daysLeft > 0 && (
              <p className="muted small field-hint">
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
            className="btn-primary btn-full icon-label"
            onClick={generate}
            disabled={busy || daysLeft <= 0}
            style={{ justifyContent: "center" }}
          >
            {busy ? <Spinner label="Generating plan…" /> : <>Generate study plan <ArrowRight size={14} /></>}
          </button>

          {error && <div style={{ marginTop: 10 }}><ErrorBanner>{error}</ErrorBanner></div>}
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
                    background: a.avg_p >= 0.8 ? "var(--green)" : a.avg_p >= 0.4 ? "var(--amber)" : "var(--red)",
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
            <div className="muted"><Spinner label="Generating your personalised study plan…" /></div>
            <div className="muted small field-hint">This takes ~10–15 seconds</div>
          </div>
        )}

        {plan && !busy && (
          <div className="panel">
            <div className="panel-header">
              <h2>Your study plan</h2>
              <button className="btn-ghost btn-sm icon-label" onClick={() => { setPlan(null); }}>
                <X size={12} /> clear
              </button>
            </div>
            <div className="markdown">
              <Markdown>{plan}</Markdown>
            </div>
            <div className="regen-row">
              <button className="btn-ghost btn-sm icon-label" onClick={generate}>
                <RefreshCw size={12} /> Regenerate
              </button>
            </div>
          </div>
        )}

        {!plan && !busy && (
          <div className="panel center-panel plan-empty-state">
            <div className="muted plan-empty-text">
              Set your target date and click <strong>Generate study plan</strong> to get a personalised schedule.
            </div>
            <p className="muted small field-hint">
              The plan uses your current mastery data to prioritise weak areas and unmastered concepts.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

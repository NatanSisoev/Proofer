"use client";

import { useState, useEffect } from "react";
import { X } from "./Icons";

type Target = { area: string; date: string };

export default function ExamPacingSettings() {
  const [areas, setAreas] = useState<string[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [area, setArea] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/settings/exam")
      .then((r) => r.json())
      .then((data) => {
        setAreas(data.areas || []);
        setTargets(data.targets || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const availableAreas = areas.filter((a) => !targets.some((t) => t.area === a));

  useEffect(() => {
    if (!area && availableAreas.length > 0) setArea(availableAreas[0]);
  }, [availableAreas, area]);

  async function add() {
    if (!area || !date || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/settings/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopeType: "area", scopeValue: area, date }),
      });
      if (res.ok) {
        setTargets((prev) => [...prev.filter((t) => t.area !== area), { area, date }]);
        setArea("");
        setDate("");
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(targetArea: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopeType: "area", scopeValue: targetArea, date: "" }),
      });
      if (res.ok) setTargets((prev) => prev.filter((t) => t.area !== targetArea));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted small">Loading…</p>;

  return (
    <div>
      {targets.length > 0 && (
        <div className="flex-col" style={{ gap: 6, marginBottom: 12 }}>
          {targets.map((t) => (
            <div key={t.area} className="area-row">
              <span className="area-name">{t.area}</span>
              <span className="muted small">{t.date}</span>
              <button
                type="button"
                className="btn-ghost btn-xs icon-label"
                onClick={() => remove(t.area)}
                disabled={busy}
                style={{ flexShrink: 0 }}
              >
                <X size={11} /> remove
              </button>
            </div>
          ))}
        </div>
      )}

      {availableAreas.length > 0 ? (
        <div className="action-row">
          <select
            id="exam-area-select"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            disabled={busy}
            className="field-select-lg"
          >
            {availableAreas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <input
            id="exam-date-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={busy}
            className="field-input"
            style={{ maxWidth: 160 }}
          />
          <button id="exam-add-btn" className="btn-primary btn-sm" onClick={add} disabled={busy || !area || !date}>
            Add
          </button>
        </div>
      ) : (
        <p className="muted small">Every area has a target set.</p>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Settings = {
  daily_goal: string;
  voice_lang: string;
};

type ProviderInfo = {
  provider: "gemini" | "anthropic" | "none";
  label: string;
  model: string | null;
  hasKey: boolean;
};

const VOICE_LANGS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "es-ES", label: "Spanish" },
  { value: "fr-FR", label: "French" },
  { value: "de-DE", label: "German" },
  { value: "it-IT", label: "Italian" },
  { value: "pt-PT", label: "Portuguese" },
  { value: "ca-ES", label: "Catalan" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({ daily_goal: "5", voice_lang: "en-US" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      });
    fetch("/api/provider")
      .then((r) => r.json())
      .then(setProvider)
      .catch(() => {});
  }, []);

  async function save(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, letterSpacing: "-0.02em" }}>Settings</h1>
          <p className="muted small" style={{ marginTop: 4 }}>Preferences for your study sessions</p>
        </div>
        <Link href="/" className="muted small">← home</Link>
      </div>

      {loading ? (
        <div className="panel muted">Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Daily goal */}
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Daily goal</h2>
            <p className="muted small" style={{ marginTop: -4, marginBottom: 16 }}>
              How many concepts you aim to practice each day. Shown in the progress bar on the home page.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[3, 5, 8, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => save({ daily_goal: String(n) })}
                  className={String(settings.daily_goal) === String(n) ? "btn-primary" : "btn-ghost"}
                  style={{ minWidth: 48 }}
                  disabled={saving}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="muted small" style={{ marginTop: 10, marginBottom: 0 }}>
              Current: <strong>{settings.daily_goal} concepts / day</strong>
            </p>
          </div>

          {/* Voice language */}
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Voice input language</h2>
            <p className="muted small" style={{ marginTop: -4, marginBottom: 16 }}>
              Language for the 🎤 Speak button. Used by the Web Speech API in your browser.
            </p>
            <select
              value={settings.voice_lang}
              onChange={(e) => save({ voice_lang: e.target.value })}
              disabled={saving}
              style={{
                background: "var(--bg-soft)", border: "1px solid var(--border)",
                color: "var(--text)", borderRadius: 8, padding: "8px 12px",
                fontSize: 14, width: "100%", maxWidth: 260,
              }}
            >
              {VOICE_LANGS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Saved indicator */}
          {saved && (
            <div style={{
              padding: "10px 14px", background: "var(--accent-soft)", border: "1px solid var(--border)",
              borderRadius: 8, fontSize: 13, color: "var(--green)", fontWeight: 600,
            }}>
              Settings saved
            </div>
          )}

          {/* Export personal notes */}
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Export personal notes</h2>
            <p className="muted small" style={{ marginTop: -4, marginBottom: 14 }}>
              Download all your personal annotations on concept pages as a Markdown file.
            </p>
            <a
              href="/api/notes/export"
              download="proofer-notes.md"
              className="btn-ghost"
              style={{ display: "inline-block", textDecoration: "none", fontSize: 13 }}
            >
              ⬇ Download notes.md
            </a>
          </div>

          {/* Info: LLM provider */}
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>LLM provider</h2>

            {/* Active provider/model badge */}
            <div
              style={{
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                padding: "10px 14px", borderRadius: 10, marginTop: 4, marginBottom: 14,
                background: provider && !provider.hasKey ? "var(--amber-soft)" : "var(--green-soft)",
                border: "1px solid var(--border)",
              }}
            >
              <span
                style={{
                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  background: provider && !provider.hasKey ? "var(--amber)" : "var(--green)",
                }}
              />
              {!provider ? (
                <span className="muted small">Checking…</span>
              ) : provider.hasKey ? (
                <span style={{ fontSize: 13.5 }}>
                  Currently answering with <strong>{provider.label}</strong>
                  {provider.model && (
                    <code style={{ marginLeft: 6, fontSize: 12 }}>{provider.model}</code>
                  )}
                </span>
              ) : (
                <span style={{ fontSize: 13.5, color: "var(--amber)" }}>
                  <strong>Demo mode</strong> — no API key set. Problems and grading use canned
                  stubs; explain / compare / study-plan are disabled.
                </span>
              )}
            </div>

            <p className="muted small" style={{ marginTop: 0 }}>
              The provider is configured via environment variables in <code>.env.local</code>:{" "}
              <code>GEMINI_API_KEY</code> selects the free Gemini tier (preferred),{" "}
              <code>ANTHROPIC_API_KEY</code> selects Claude. Gemini wins if both are set.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <Link href="/quality" className="pill" style={{ color: "var(--accent)", borderColor: "var(--accent-soft)" }}>
                Note quality →
              </Link>
              <Link href="/progress" className="pill" style={{ color: "var(--accent)", borderColor: "var(--accent-soft)" }}>
                Progress →
              </Link>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

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
    <div className="wrap wrap-narrow">
      <div className="page-top" style={{ marginBottom: 28 }}>
        <div>
          <h1>Settings</h1>
          <p className="muted small" style={{ marginTop: 4 }}>Preferences for your study sessions</p>
        </div>
        <Link href="/" className="muted small">← home</Link>
      </div>

      {loading ? (
        <div className="panel muted">Loading…</div>
      ) : (
        <div className="panel-stack">

          {/* Daily goal */}
          <div className="panel">
            <h2>Daily goal</h2>
            <p className="muted small panel-desc">
              How many concepts you aim to practice each day. Shown in the progress bar on the home page.
            </p>
            <div className="action-row">
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
            <p className="muted small panel-tip">
              Current: <strong>{settings.daily_goal} concepts / day</strong>
            </p>
          </div>

          {/* Voice language */}
          <div className="panel">
            <h2>Voice input language</h2>
            <p className="muted small panel-desc">
              Language for the 🎤 Speak button. Used by the Web Speech API in your browser.
            </p>
            <select
              value={settings.voice_lang}
              onChange={(e) => save({ voice_lang: e.target.value })}
              disabled={saving}
              className="field-select-lg"
            >
              {VOICE_LANGS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Saved indicator */}
          {saved && (
            <div className="save-notice">Settings saved</div>
          )}

          {/* Export personal notes */}
          <div className="panel">
            <h2>Export personal notes</h2>
            <p className="muted small panel-desc">
              Download all your personal annotations on concept pages as a Markdown file.
            </p>
            <a
              href="/api/notes/export"
              download="proofer-notes.md"
              className="btn-ghost btn-download"
            >
              ⬇ Download notes.md
            </a>
          </div>

          {/* Info: LLM provider */}
          <div className="panel">
            <h2>LLM provider</h2>

            {/* Active provider/model badge */}
            <div
              className="provider-banner"
              style={{ background: provider && !provider.hasKey ? "var(--amber-soft)" : "var(--green-soft)" }}
            >
              <span
                className="verdict-dot-sm"
                style={{ background: provider && !provider.hasKey ? "var(--amber)" : "var(--green)" }}
              />
              {!provider ? (
                <span className="muted small">Checking…</span>
              ) : provider.hasKey ? (
                <span style={{ fontSize: 13.5 }}>
                  Currently answering with <strong>{provider.label}</strong>
                  {provider.model && (
                    <code className="model-code">{provider.model}</code>
                  )}
                </span>
              ) : (
                <span className="warn-text">
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
            <div className="panel-link-row">
              <Link href="/quality" className="pill pill-accent">
                Note quality →
              </Link>
              <Link href="/progress" className="pill pill-accent">
                Progress →
              </Link>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

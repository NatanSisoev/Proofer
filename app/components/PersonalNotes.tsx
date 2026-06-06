"use client";

import { useState, useEffect, useRef } from "react";

type Props = { nodeId: string };

/**
 * Personal annotation panel — lets the student jot down their own notes
 * (mnemonics, confusions, insights) on any concept. Auto-saves on blur
 * and after a short debounce.
 */
export default function PersonalNotes({ nodeId }: Props) {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/node/${encodeURIComponent(nodeId)}/notes`)
      .then((r) => r.json())
      .then((d) => {
        setContent(d.content ?? "");
        if (d.content) setOpen(true);
        setLoaded(true);
      });
  }, [nodeId]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [content, open]);

  async function save(text: string) {
    setSaving(true);
    try {
      await fetch(`/api/node/${encodeURIComponent(nodeId)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setContent(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(val), 800);
  }

  if (!loaded) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: content ? "var(--text)" : "var(--muted)",
          fontSize: 13, fontWeight: content ? 600 : 400,
          padding: "4px 0", display: "flex", alignItems: "center", gap: 6,
        }}
      >
        <span style={{ fontSize: 15 }}>📝</span>
        {content ? "My notes" : "Add personal notes"}
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{open ? "↑" : "↓"}</span>
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onBlur={() => { if (saveTimer.current) clearTimeout(saveTimer.current); save(content); }}
            placeholder="Jot down your own understanding, mnemonics, confusions, insights… Only you see this."
            style={{
              width: "100%", minHeight: 80, padding: "12px 14px",
              background: "#0c1520", border: "1px solid #2a3a50",
              borderRadius: 10, color: "var(--text)", fontSize: 14,
              lineHeight: 1.65, fontFamily: "inherit", resize: "none",
              overflow: "hidden",
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 3 }}>
            <span className="muted small" style={{ fontSize: 11 }}>
              {saving ? "Saving…" : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "Type to add notes · auto-saves"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

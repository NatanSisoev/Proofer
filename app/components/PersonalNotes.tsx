"use client";

import { useState, useEffect, useRef } from "react";
import Markdown from "./Markdown";

type Props = { nodeId: string };

const SNIPPETS = [
  { label: "$·$",  insert: "$ | $" },
  { label: "frac", insert: "\\frac{|}{}" },
  { label: "√",    insert: "\\sqrt{|}" },
  { label: "∀",    insert: "\\forall " },
  { label: "∃",    insert: "\\exists " },
  { label: "∈",    insert: "\\in " },
  { label: "→",    insert: "\\to " },
  { label: "⇒",   insert: "\\Rightarrow " },
];

function insertAt(el: HTMLTextAreaElement, snippet: string): string {
  const cursor = el.selectionStart ?? 0;
  const before = el.value.slice(0, cursor);
  const after  = el.value.slice(el.selectionEnd ?? cursor);
  const ci = snippet.indexOf("|");
  const text = snippet.replace("|", "");
  const newCursor = cursor + (ci >= 0 ? ci : text.length);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(newCursor, newCursor);
  });
  return before + text + after;
}

/**
 * Personal annotation panel with LaTeX toolbar and live math preview.
 * Auto-saves on blur and after an 800 ms debounce.
 */
export default function PersonalNotes({ nodeId }: Props) {
  const [content, setContent]       = useState("");
  const [loaded, setLoaded]         = useState(false);
  const [saving, setSaving]         = useState(false);
  const [savedAt, setSavedAt]       = useState<Date | null>(null);
  const [open, setOpen]             = useState(false);
  const [preview, setPreview]       = useState(false);
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
    if (!el || !open) return;
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

  function handleChange(val: string) {
    setContent(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(val), 800);
  }

  if (!loaded) return null;

  const hasMath = /\$|\\\[/.test(content);

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
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => { if (saveTimer.current) clearTimeout(saveTimer.current); save(content); }}
            placeholder="Jot down your own understanding, mnemonics, confusions, insights… Supports LaTeX with $…$. Only you see this."
            style={{
              width: "100%", minHeight: 80, padding: "12px 14px",
              background: "#0c1520", border: "1px solid #2a3a50",
              borderRadius: 10, color: "var(--text)", fontSize: 14,
              lineHeight: 1.65, fontFamily: "inherit", resize: "none",
              overflow: "hidden",
            }}
          />

          {/* LaTeX snippet toolbar */}
          <div
            style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {SNIPPETS.map(({ label, insert }) => (
              <button
                key={label}
                type="button"
                tabIndex={-1}
                onClick={() => {
                  if (!textareaRef.current) return;
                  handleChange(insertAt(textareaRef.current, insert));
                }}
                style={{
                  padding: "2px 6px", fontSize: 11, fontFamily: "monospace",
                  background: "var(--bg-soft)", border: "1px solid var(--border)",
                  borderRadius: 4, color: "var(--muted)", cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
            {hasMath && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setPreview((p) => !p)}
                style={{
                  marginLeft: "auto", padding: "2px 8px", fontSize: 11,
                  background: preview ? "var(--accent-soft)" : "var(--bg-soft)",
                  border: `1px solid ${preview ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 4, color: preview ? "var(--accent)" : "var(--muted)",
                  cursor: "pointer",
                }}
              >
                {preview ? "Hide preview" : "Math preview"}
              </button>
            )}
          </div>

          {preview && hasMath && content.trim() && (
            <div style={{
              marginTop: 6, padding: "10px 14px",
              background: "var(--bg-soft)", border: "1px solid var(--border)",
              borderRadius: 8, fontSize: 13.5,
            }}>
              <Markdown>{content}</Markdown>
            </div>
          )}

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

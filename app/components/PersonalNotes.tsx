"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Pencil, ChevronUp, ChevronDown } from "./Icons";

const Markdown = dynamic(() => import("./Markdown"));

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

export default function PersonalNotes({ nodeId }: Props) {
  const [content, setContent]       = useState("");
  const [loaded, setLoaded]         = useState(false);
  const [saving, setSaving]         = useState(false);
  const [savedAt, setSavedAt]       = useState<Date | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
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
      const res = await fetch(`/api/node/${encodeURIComponent(nodeId)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) throw new Error();
      setSavedAt(new Date());
      setSaveFailed(false);
    } catch {
      // Persistent (not transient) — a false "Saved" here is silent data
      // loss. The text is still in the textarea; auto-save retries on the
      // next edit/blur, and success clears this.
      setSaveFailed(true);
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
        className="notes-toggle"
        style={{
          color: content ? "var(--text)" : "var(--muted)",
          fontWeight: content ? 600 : 400,
        }}
      >
        <Pencil size={14} />
        {content ? "My notes" : "Add personal notes"}
        <span className="muted" style={{ display: "inline-flex" }}>{open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}</span>
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => { if (saveTimer.current) clearTimeout(saveTimer.current); save(content); }}
            placeholder="Jot down your own understanding, mnemonics, confusions, insights… Supports LaTeX with $…$. Only you see this."
            className="notes-textarea"
          />

          {/* LaTeX snippet toolbar */}
          <div
            className="notes-toolbar"
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
                className="snippet-btn"
              >
                {label}
              </button>
            ))}
            {hasMath && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setPreview((p) => !p)}
                className={`snippet-btn-preview${preview ? " active" : ""}`}
              >
                {preview ? "Hide preview" : "Math preview"}
              </button>
            )}
          </div>

          {preview && hasMath && content.trim() && (
            <div className="notes-preview">
              <Markdown>{content}</Markdown>
            </div>
          )}

          <div className="notes-footer">
            {saveFailed && !saving ? (
              <span className="small" style={{ fontSize: 11, color: "var(--red)" }}>
                Couldn&rsquo;t save — your text is still here; editing or clicking away retries
              </span>
            ) : (
              <span className="muted small" style={{ fontSize: 11 }}>
                {saving ? "Saving…" : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "Type to add notes · auto-saves"}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

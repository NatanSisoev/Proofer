"use client";

import { useRef, useEffect } from "react";
import Markdown from "./Markdown";

type Props = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  autoFocus?: boolean;
};

/** Detect if the answer contains any LaTeX so we can show a preview. */
function hasMath(s: string): boolean {
  return /\$|\\\[|\\\(/.test(s);
}

/**
 * LaTeX quick-insert snippets. Each entry has:
 *   label   — the text shown on the button
 *   insert  — text to insert (| marks cursor position)
 */
const LATEX_SNIPPETS = [
  { label: "$·$",    insert: "$ | $" },
  { label: "$$·$$",  insert: "$$\n|\n$$" },
  { label: "frac",   insert: "\\frac{|}{}" },
  { label: "√",      insert: "\\sqrt{|}" },
  { label: "Σ",      insert: "\\sum_{|}^{}" },
  { label: "∫",      insert: "\\int_{|}^{}" },
  { label: "∞",      insert: "\\infty" },
  { label: "∀",      insert: "\\forall " },
  { label: "∃",      insert: "\\exists " },
  { label: "∈",      insert: "\\in " },
  { label: "⊆",      insert: "\\subseteq " },
  { label: "→",      insert: "\\to " },
  { label: "⇒",      insert: "\\Rightarrow " },
  { label: "⟺",     insert: "\\Leftrightarrow " },
  { label: "lim",    insert: "\\lim_{| \\to }" },
];

/**
 * Insert a snippet into a textarea, placing the cursor where | appears.
 * Returns the new string value; also updates the textarea selection.
 */
function insertSnippet(el: HTMLTextAreaElement, snippet: string): string {
  const cursorPos = el.selectionStart ?? 0;
  const before = el.value.slice(0, cursorPos);
  const after = el.value.slice(el.selectionEnd ?? cursorPos);
  const cursorInSnippet = snippet.indexOf("|");
  const text = snippet.replace("|", "");
  const newVal = before + text + after;
  // Schedule cursor placement after React re-render
  const newCursor = cursorPos + (cursorInSnippet >= 0 ? cursorInSnippet : text.length);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(newCursor, newCursor);
  });
  return newVal;
}

/**
 * Auto-growing textarea with:
 *  - Live KaTeX preview panel (appears when value contains LaTeX)
 *  - LaTeX quick-insert toolbar (always shown when not disabled)
 * Drop-in replacement for <textarea>.
 */
export default function AnswerBox({
  value,
  onChange,
  disabled,
  placeholder,
  style,
  className,
  onKeyDown,
  autoFocus,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow: match height to content each time value changes.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const showPreview = value.trim().length > 0 && hasMath(value);
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <div>
      <textarea
        ref={ref}
        className={className ?? "answer-box"}
        placeholder={
          placeholder ??
          "Write your answer — proof, definition, counterexample, reasoning. Type $...$ for LaTeX."
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{ overflow: "hidden", ...style }}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
      />

      {/* LaTeX quick-insert toolbar */}
      {!disabled && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            marginTop: 5,
            paddingBottom: 2,
          }}
          onMouseDown={(e) => e.preventDefault()} // keep textarea focused
        >
          {LATEX_SNIPPETS.map(({ label, insert }) => (
            <button
              key={label}
              type="button"
              tabIndex={-1}
              onClick={() => {
                if (!ref.current) return;
                onChange(insertSnippet(ref.current, insert));
              }}
              style={{
                padding: "2px 7px",
                fontSize: 12,
                fontFamily: "monospace",
                background: "var(--bg-soft)",
                border: "1px solid var(--border)",
                borderRadius: 5,
                color: "var(--muted)",
                cursor: "pointer",
                lineHeight: 1.6,
                userSelect: "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {wordCount > 0 && (
        <div style={{ textAlign: "right", marginTop: 3 }}>
          <span className="muted small">{wordCount} word{wordCount !== 1 ? "s" : ""}</span>
        </div>
      )}

      {showPreview && (
        <div
          style={{
            marginTop: 4,
            padding: "10px 14px",
            background: "var(--bg-soft)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 13.5,
          }}
        >
          <div
            className="muted small"
            style={{ marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em", fontSize: 10, fontWeight: 700 }}
          >
            Math preview
          </div>
          <Markdown>{value}</Markdown>
        </div>
      )}
    </div>
  );
}

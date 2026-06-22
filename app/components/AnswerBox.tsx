"use client";

import { useRef, useEffect } from "react";
import dynamic from "next/dynamic";

const Markdown = dynamic(() => import("./Markdown"));

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

function hasMath(s: string): boolean {
  return /\$|\\\[|\\\(/.test(s);
}

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

function insertSnippet(el: HTMLTextAreaElement, snippet: string): string {
  const cursorPos = el.selectionStart ?? 0;
  const before = el.value.slice(0, cursorPos);
  const after = el.value.slice(el.selectionEnd ?? cursorPos);
  const cursorInSnippet = snippet.indexOf("|");
  const text = snippet.replace("|", "");
  const newVal = before + text + after;
  const newCursor = cursorPos + (cursorInSnippet >= 0 ? cursorInSnippet : text.length);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(newCursor, newCursor);
  });
  return newVal;
}

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

      <div className="answer-toolbar-row">
        {!disabled && (
          <div className="latex-toolbar" onMouseDown={(e) => e.preventDefault()}>
            {LATEX_SNIPPETS.map(({ label, insert }) => (
              <button
                key={label}
                type="button"
                tabIndex={-1}
                onClick={() => {
                  if (!ref.current) return;
                  onChange(insertSnippet(ref.current, insert));
                }}
                className="latex-snippet-btn"
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {wordCount > 0 && (
          <div className="word-count">
            <span className="muted small">{wordCount} word{wordCount !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {showPreview && (
        <div className="notes-preview" style={{ marginTop: 4 }}>
          <div className="panel-label label-xs" style={{ marginBottom: 6 }}>
            Math preview
          </div>
          <Markdown>{value}</Markdown>
        </div>
      )}
    </div>
  );
}

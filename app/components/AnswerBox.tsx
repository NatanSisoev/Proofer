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
 * Auto-growing textarea with a live KaTeX preview panel that appears whenever
 * the user types LaTeX ($...$  or  $$...$$). Keeps the same external API as a
 * plain <textarea> so it's a drop-in replacement.
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

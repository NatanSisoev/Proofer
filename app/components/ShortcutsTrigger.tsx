"use client";

import { HelpCircle } from "./Icons";

/** Fires a synthetic keydown "?" so the KeyboardShortcuts listener toggles the modal. */
export default function ShortcutsTrigger() {
  function open() {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "?", bubbles: true })
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      title="Keyboard shortcuts (?)"
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "var(--muted)",
        padding: "4px 6px",
        display: "flex",
        alignItems: "center",
      }}
    >
      <HelpCircle size={16} />
    </button>
  );
}

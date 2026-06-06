"use client";

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
        fontSize: 15,
        fontWeight: 700,
        padding: "2px 6px",
        borderRadius: 6,
        lineHeight: 1,
        userSelect: "none",
      }}
    >
      ?
    </button>
  );
}

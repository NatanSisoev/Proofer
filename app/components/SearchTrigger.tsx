"use client";

import { Search } from "./Icons";

/**
 * Nav-bar button that opens the global search overlay.
 * Dispatches a synthetic "/" keydown so GlobalSearch handles it.
 */
export default function SearchTrigger() {
  function open() {
    const local = document.querySelector<HTMLInputElement>(".search-box");
    if (local) { local.focus(); return; }
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "/", bubbles: true })
    );
  }

  return (
    <button
      onClick={open}
      title="Search (press /)"
      style={{
        background: "none", border: "none", cursor: "pointer",
        color: "var(--muted)", fontSize: 15, padding: "4px 6px",
        display: "flex", alignItems: "center",
      }}
    >
      <Search size={16} />
    </button>
  );
}

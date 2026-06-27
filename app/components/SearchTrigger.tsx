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
      className="nav-icon-btn"
      style={{ background: "none", border: "none", cursor: "pointer" }}
    >
      <Search size={16} />
    </button>
  );
}

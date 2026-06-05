"use client";

import { useState, useTransition } from "react";

export default function BookmarkButton({ nodeId, initial }: { nodeId: string; initial: boolean }) {
  const [bookmarked, setBookmarked] = useState(initial);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !bookmarked;
    setBookmarked(next);
    start(async () => {
      await fetch("/api/bookmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId }),
      });
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      title={bookmarked ? "Remove bookmark" : "Bookmark for later"}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: 18,
        lineHeight: 1,
        color: bookmarked ? "var(--amber)" : "var(--muted)",
        opacity: pending ? 0.5 : 1,
        transition: "color 0.2s, transform 0.1s",
        padding: "4px 6px",
        borderRadius: 6,
      }}
    >
      {bookmarked ? "★" : "☆"}
    </button>
  );
}

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
      className="btn-bookmark"
      style={{
        color: bookmarked ? "var(--amber)" : "var(--muted)",
        opacity: pending ? 0.5 : 1,
      }}
    >
      {bookmarked ? "★" : "☆"}
    </button>
  );
}

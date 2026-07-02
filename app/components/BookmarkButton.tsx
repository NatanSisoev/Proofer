"use client";

import { useState, useTransition } from "react";
import { Star } from "./Icons";

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
      className={`btn-ghost btn-sm icon-label${bookmarked ? " is-bookmarked" : ""}`}
    >
      <Star size={14} filled={bookmarked} /> {bookmarked ? "Saved" : "Save"}
    </button>
  );
}

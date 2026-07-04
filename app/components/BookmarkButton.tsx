"use client";

import { useState, useTransition } from "react";
import { Star } from "./Icons";
import { useTransientFlag } from "./useTransientFlag";

export default function BookmarkButton({ nodeId, initial }: { nodeId: string; initial: boolean }) {
  const [bookmarked, setBookmarked] = useState(initial);
  const [pending, start] = useTransition();
  const [failed, raiseFailed] = useTransientFlag();

  function toggle() {
    const prev = bookmarked;
    setBookmarked(!prev);
    start(async () => {
      try {
        const res = await fetch("/api/bookmark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId }),
        });
        if (!res.ok) throw new Error();
      } catch {
        setBookmarked(prev);
        raiseFailed();
      }
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      title={failed ? "Couldn't save — click to retry" : bookmarked ? "Remove bookmark" : "Bookmark for later"}
      className={`btn-ghost btn-sm icon-label${bookmarked ? " is-bookmarked" : ""}${failed ? " btn-failed" : ""}`}
    >
      <Star size={14} filled={bookmarked} /> {failed ? "Failed" : bookmarked ? "Saved" : "Save"}
    </button>
  );
}

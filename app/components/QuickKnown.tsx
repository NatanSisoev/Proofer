"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function QuickKnown({ nodeId }: { nodeId: string }) {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function mark() {
    setDone(true);
    start(async () => {
      await fetch("/api/known", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: nodeId, known: true }),
      });
      router.refresh();
    });
  }

  if (done) {
    return <span className="quick-known-done">✓ known</span>;
  }

  return (
    <button
      onClick={mark}
      disabled={pending}
      title="Mark as known"
      className="quick-known-btn"
    >
      know
    </button>
  );
}

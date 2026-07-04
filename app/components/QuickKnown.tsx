"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "./Icons";
import { useTransientFlag } from "./useTransientFlag";

export default function QuickKnown({ nodeId }: { nodeId: string }) {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const [failed, raiseFailed] = useTransientFlag();
  const router = useRouter();

  function mark() {
    setDone(true);
    start(async () => {
      try {
        const res = await fetch("/api/known", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: nodeId, known: true }),
        });
        if (!res.ok) throw new Error();
        router.refresh();
      } catch {
        setDone(false);
        raiseFailed();
      }
    });
  }

  if (done) {
    return <span className="quick-known-done icon-label"><Check size={12} /> known</span>;
  }

  return (
    <button
      onClick={mark}
      disabled={pending}
      title={failed ? "Couldn't save — click to retry" : "Mark as known"}
      className={`quick-known-btn${failed ? " btn-failed" : ""}`}
    >
      {failed ? "failed" : "know"}
    </button>
  );
}

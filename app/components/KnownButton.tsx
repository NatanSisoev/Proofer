"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "./Icons";
import { useTransientFlag } from "./useTransientFlag";

export default function KnownButton({ slug, initial }: { slug: string; initial: boolean }) {
  const [known, setKnown] = useState(initial);
  const [pending, start] = useTransition();
  const [failed, raiseFailed] = useTransientFlag();
  const router = useRouter();

  function toggle() {
    const prev = known;
    const next = !prev;
    setKnown(next);
    start(async () => {
      try {
        const res = await fetch("/api/known", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: slug, known: next }),
        });
        if (!res.ok) throw new Error();
        router.refresh(); // re-run readiness on the server
      } catch {
        setKnown(prev);
        raiseFailed();
      }
    });
  }

  return (
    <button
      className={`btn-ghost btn-sm icon-label${known ? " is-known" : ""}${failed ? " btn-failed" : ""}`}
      onClick={toggle}
      disabled={pending}
      title={failed ? "Couldn't save — click to retry" : undefined}
    >
      {failed ? "Failed" : known ? <><Check size={14} /> I know this</> : "Mark as known"}
    </button>
  );
}

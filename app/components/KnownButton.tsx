"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "./Icons";

export default function KnownButton({ slug, initial }: { slug: string; initial: boolean }) {
  const [known, setKnown] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggle() {
    const next = !known;
    setKnown(next);
    start(async () => {
      await fetch("/api/known", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: slug, known: next }),
      });
      router.refresh(); // re-run readiness on the server
    });
  }

  return (
    <button className={`btn-ghost btn-sm icon-label${known ? " is-known" : ""}`} onClick={toggle} disabled={pending}>
      {known ? <><Check size={14} /> I know this</> : "Mark as known"}
    </button>
  );
}

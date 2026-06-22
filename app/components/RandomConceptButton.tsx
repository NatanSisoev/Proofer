"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dice } from "./Icons";

export default function RandomConceptButton({ mastered = "false", label = "Explore random" }: {
  mastered?: "false" | "true" | "any";
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function go() {
    setBusy(true);
    try {
      const res = await fetch(`/api/random?mastered=${mastered}`);
      const data = await res.json();
      if (data.id) router.push(`/node/${encodeURIComponent(data.id)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className="btn-ghost icon-label"
      onClick={go}
      disabled={busy}
      style={{ fontSize: 13 }}
      title="Jump to a random unmastered concept"
    >
      {busy ? "…" : <><Dice size={13} /> {label}</>}
    </button>
  );
}

"use client";

import { useState } from "react";

export default function SyncButton() {
  const [state, setState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function sync() {
    setState("syncing");
    setMsg("");
    try {
      const res = await fetch("/api/vault/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setMsg(data.summary || "Sync complete");
      setState("done");
      setTimeout(() => setState("idle"), 5000);
    } catch (e: any) {
      setMsg(e.message);
      setState("error");
      setTimeout(() => setState("idle"), 6000);
    }
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button
        onClick={sync}
        disabled={state === "syncing"}
        className="btn-ghost"
        style={{ fontSize: 12, padding: "5px 12px" }}
      >
        {state === "syncing" ? "Syncing…" : "↺ Sync vault"}
      </button>
      {msg && (
        <span
          className="small"
          style={{
            color: state === "error" ? "var(--red)" : "var(--green)",
            maxWidth: 280,
            textAlign: "right",
            lineHeight: 1.4,
            whiteSpace: "pre-wrap",
          }}
        >
          {msg}
        </span>
      )}
    </div>
  );
}

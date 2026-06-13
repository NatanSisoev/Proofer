"use client";

import { useState, useEffect } from "react";

export default function SyncButton() {
  const [state, setState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);

  // Tick an elapsed-seconds counter while a sync is in flight. The import can
  // take up to ~90s on the full vault; without a live counter "Syncing…" looks
  // frozen and the button feels unsafe to click.
  useEffect(() => {
    if (state !== "syncing") return;
    const start = Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 250);
    return () => clearInterval(t);
  }, [state]);

  async function sync() {
    if (state === "syncing") return;
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
        style={{ fontSize: 12, padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        {state === "syncing" ? (
          <>
            <span className="sync-spin" aria-hidden style={{ display: "inline-block" }}>↻</span>
            Syncing… {elapsed}s
          </>
        ) : (
          "↺ Sync vault"
        )}
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

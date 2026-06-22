"use client";

import { useState, useEffect } from "react";
import { RefreshCw } from "./Icons";

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
    <div className="sync-wrapper">
      <button
        onClick={sync}
        disabled={state === "syncing"}
        className="btn-ghost sync-btn"
      >
        {state === "syncing" ? (
          <>
            <RefreshCw size={13} className="sync-spin" style={{ display: "inline-block" }} />
            Syncing… {elapsed}s
          </>
        ) : (
          <>
            <RefreshCw size={13} style={{ display: "inline-block" }} /> Sync vault
          </>
        )}
      </button>
      {msg && (
        <span
          className="small sync-status"
          style={{ color: state === "error" ? "var(--red)" : "var(--green)" }}
        >
          {msg}
        </span>
      )}
    </div>
  );
}

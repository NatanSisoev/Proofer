"use client";

import { useState } from "react";
import { Check } from "./Icons";
import { useTransientFlag } from "./useTransientFlag";

export default function GoalButton({
  nodeId,
  isCurrentGoal,
}: {
  nodeId: string;
  isCurrentGoal: boolean;
}) {
  const [active, setActive] = useState(isCurrentGoal);
  const [busy, setBusy] = useState(false);
  const [failed, raiseFailed] = useTransientFlag();

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: active ? "" : nodeId }),
      });
      if (!res.ok) throw new Error();
      setActive(!active);
    } catch {
      raiseFailed();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={failed ? "Couldn't save — click to retry" : active ? "Clear learning goal" : "Set as learning goal — shows the path to this concept on your home page"}
      className={`btn-ghost btn-sm icon-label${active ? " goal-btn-active" : ""}${failed ? " btn-failed" : ""}`}
      style={{ whiteSpace: "nowrap" }}
    >
      {failed ? "Failed" : active ? <><Check size={13} /> Goal</> : "Set as goal"}
    </button>
  );
}

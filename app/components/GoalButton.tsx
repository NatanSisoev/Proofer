"use client";

import { useState } from "react";

export default function GoalButton({
  nodeId,
  isCurrentGoal,
}: {
  nodeId: string;
  isCurrentGoal: boolean;
}) {
  const [active, setActive] = useState(isCurrentGoal);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await fetch("/api/settings/goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: active ? "" : nodeId }),
      });
      setActive(!active);
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={active ? "Clear learning goal" : "Set as learning goal — shows the path to this concept on your home page"}
      className={`btn-ghost btn-sm${active ? " goal-btn-active" : ""}`}
      style={{ whiteSpace: "nowrap" }}
    >
      {active ? "Goal ✓" : "Set as goal"}
    </button>
  );
}

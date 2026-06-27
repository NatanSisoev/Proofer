"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import MathText from "./MathText";

type UnlockNode = { id: string; title: string; area: string | null; type: string | null };

/**
 * Interactive "unlocks N" pill for frontier items on the home page.
 * Click to fetch and show which specific concepts would become learnable
 * once this concept is mastered — makes Proofer's core value proposition tangible.
 */
export default function UnlockPreview({ nodeId, unlockCount }: { nodeId: string; unlockCount: number }) {
  const [open, setOpen] = useState(false);
  const [nodes, setNodes] = useState<UnlockNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (nodes !== null) return; // already loaded
    setLoading(true);
    try {
      const res = await fetch(`/api/newly-unlocked?nodes=${encodeURIComponent(nodeId)}`);
      const data: UnlockNode[] = await res.json();
      setNodes(data);
    } catch {
      setNodes([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        className="pill unlock"
        onClick={toggle}
        title="Click to see which concepts this would unlock"
        style={{ cursor: "pointer" }}
      >
        unlocks {unlockCount}
      </button>

      {open && (
        <div className="unlock-popover">
          {loading && <p className="muted small" style={{ margin: "4px 0" }}>Loading…</p>}
          {!loading && nodes !== null && nodes.length === 0 && (
            <p className="muted small" style={{ margin: "4px 0" }}>No immediate unlocks.</p>
          )}
          {!loading && nodes && nodes.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {nodes.map((n) => (
                <li key={n.id} className="unlock-popover-item">
                  {n.type && <span className={`type-badge t-${n.type}`}>{n.type}</span>}
                  <Link href={`/node/${encodeURIComponent(n.id)}`} onClick={() => setOpen(false)}>
                    <MathText>{n.title}</MathText>
                  </Link>
                  {n.area && <span className="muted small"> · {n.area}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

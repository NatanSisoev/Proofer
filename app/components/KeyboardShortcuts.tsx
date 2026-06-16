"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SHORTCUTS = [
  { key: "s / /", desc: "Focus search" },
  { key: "p",     desc: "Practice (free)" },
  { key: "e",     desc: "Study session" },
  { key: "b",     desc: "Browse topics" },
  { key: "g",     desc: "Knowledge map" },
  { key: "r",     desc: "Progress" },
  { key: "x",     desc: "Explore random concept" },
  { key: "y",     desc: "History" },
  { key: "n",     desc: "Study plan" },
  { key: "q",     desc: "Note quality" },
  { key: "h",     desc: "Home" },
  { key: "?",     desc: "Toggle this help" },
  { key: "Esc",   desc: "Close help" },
];

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement).isContentEditable;

      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key === "?" && !typing) { setOpen((o) => !o); return; }
      if (typing) return;

      if (e.key === "s" || e.key === "/") {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>(".search-box");
        el?.focus();
        return;
      }
      if (e.key === "p") { router.push("/learn"); return; }
      if (e.key === "e") { router.push("/session"); return; }
      if (e.key === "b") { router.push("/browse"); return; }
      if (e.key === "g") { router.push("/graph"); return; }
      if (e.key === "r") { router.push("/progress"); return; }
      if (e.key === "x") {
        fetch("/api/random").then(r => r.json()).then(d => { if (d.id) router.push(`/node/${encodeURIComponent(d.id)}`); });
        return;
      }
      if (e.key === "y") { router.push("/history"); return; }
      if (e.key === "n") { router.push("/study-plan"); return; }
      if (e.key === "q") { router.push("/quality"); return; }
      if (e.key === "h") { router.push("/"); return; }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div
        className="panel"
        style={{ minWidth: 320, padding: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 16px" }}>Keyboard shortcuts</h2>
        <table className="shortcuts-table">
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.key} className="shortcuts-row">
                <td className="shortcuts-key-cell">
                  <kbd className="kbd">{s.key}</kbd>
                </td>
                <td className="shortcuts-desc">{s.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small" style={{ marginTop: 12, marginBottom: 0 }}>
          Press <kbd className="kbd">{`?`}</kbd> or Esc to close
        </p>
      </div>
    </div>
  );
}

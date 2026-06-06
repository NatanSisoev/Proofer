"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SHORTCUTS = [
  { key: "s / /", desc: "Focus search" },
  { key: "p",     desc: "Practice (free)" },
  { key: "e",     desc: "Study session" },
  { key: "c",     desc: "Flashcards" },
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
      if (e.key === "c") { router.push("/flashcard"); return; }
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
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={() => setOpen(false)}
    >
      <div
        className="panel"
        style={{ minWidth: 320, padding: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 16px" }}>Keyboard shortcuts</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.key} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "8px 0" }}>
                  <kbd style={{
                    background: "var(--bg-soft)", border: "1px solid var(--border)",
                    borderRadius: 5, padding: "2px 7px", fontFamily: "monospace",
                    fontSize: 13, color: "var(--accent)",
                  }}>
                    {s.key}
                  </kbd>
                </td>
                <td style={{ padding: "8px 0 8px 16px", color: "var(--text)", fontSize: 14 }}>
                  {s.desc}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small" style={{ marginTop: 12, marginBottom: 0 }}>
          Press <kbd style={{ fontFamily: "monospace", fontSize: 12 }}>?</kbd> or Esc to close
        </p>
      </div>
    </div>
  );
}

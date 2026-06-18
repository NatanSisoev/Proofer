"use client";

import { useEffect, useState } from "react";

export default function ReadingProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    function update() {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      if (docH <= 0) { setPct(0); return; }
      setPct(Math.min(100, Math.round((window.scrollY / docH) * 100)));
    }
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, []);

  if (pct <= 0 || pct >= 100) return null;

  return (
    <div className="reading-progress-track">
      <div className="reading-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

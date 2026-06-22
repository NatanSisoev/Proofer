"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "./Icons";

export function toggleTheme() {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  window.dispatchEvent(new Event("proofer-theme-change"));
}

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const sync = () => setDark(document.documentElement.getAttribute("data-theme") === "dark");
    sync();
    window.addEventListener("proofer-theme-change", sync);
    return () => window.removeEventListener("proofer-theme-change", sync);
  }, []);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle"
      title={dark ? "Switch to light mode (d)" : "Switch to dark mode (d)"}
      aria-label="Toggle dark mode"
    >
      {dark ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  );
}

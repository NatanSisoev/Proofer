import type { Metadata } from "next";
import Link from "next/link";
import "katex/dist/katex.min.css";
import "./globals.css";
import SyncButton from "./components/SyncButton";
import KeyboardShortcuts from "./components/KeyboardShortcuts";

export const metadata: Metadata = {
  title: "Proofer — a map of mathematics",
  description: "A typed knowledge graph of mathematical concepts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="app-nav">
          <div className="app-nav-inner">
            <div className="nav-links">
              <Link href="/" className="nav-brand">Proofer</Link>
              <Link href="/browse" className="nav-link">Browse</Link>
              <Link href="/graph" className="nav-link">Map</Link>
              <Link href="/learn" className="nav-link">Practice</Link>
              <Link href="/session" className="nav-link">Session</Link>
              <Link href="/progress" className="nav-link">Progress</Link>
              <Link href="/quality" className="nav-link">Quality</Link>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <SyncButton />
              <span className="muted small" style={{ cursor: "default", userSelect: "none" }} title="Press ? for keyboard shortcuts">?</span>
            </div>
          </div>
        </nav>
        <div className="nav-spacer" />
        {children}
        <KeyboardShortcuts />
      </body>
    </html>
  );
}

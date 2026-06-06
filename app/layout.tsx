import type { Metadata } from "next";
import Link from "next/link";
import "katex/dist/katex.min.css";
import "./globals.css";
import SyncButton from "./components/SyncButton";
import KeyboardShortcuts from "./components/KeyboardShortcuts";
import ShortcutsTrigger from "./components/ShortcutsTrigger";
import NavLinks from "./components/NavLinks";

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
              <NavLinks />
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Link href="/settings" className="nav-link" title="Settings">⚙</Link>
              <SyncButton />
              <ShortcutsTrigger />
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

import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Lora } from "next/font/google";
import "./globals.css";
import KeyboardShortcuts from "./components/KeyboardShortcuts";
import GlobalSearch from "./components/GlobalSearch";
import SearchTrigger from "./components/SearchTrigger";
import ShortcutsTrigger from "./components/ShortcutsTrigger";
import DailyGoalIndicator from "./components/DailyGoalIndicator";
import NavLinks from "./components/NavLinks";
import { Settings } from "./components/Icons";

export const metadata: Metadata = {
  title: "Proofer — a map of mathematics",
  description: "A typed knowledge graph of mathematical concepts.",
};

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const lora = Lora({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

const THEME_BOOT_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem("theme");
    if (!t) t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${lora.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <nav className="app-nav">
          <div className="app-nav-inner">
            <div className="nav-links">
              <Link href="/" className="nav-brand">Proofer</Link>
              <NavLinks />
            </div>
            <div className="nav-actions">
              <DailyGoalIndicator />
              <SearchTrigger />
              <Link href="/settings" className="nav-icon-btn" title="Settings">
                <Settings size={16} />
              </Link>
              <ShortcutsTrigger />
            </div>
          </div>
        </nav>
        <div className="nav-spacer" />
        {children}
        <GlobalSearch />
        <KeyboardShortcuts />
      </body>
    </html>
  );
}

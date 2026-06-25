"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/browse", label: "Browse" },
  { href: "/graph", label: "Map" },
  { href: "/session", label: "Practice" },
  { href: "/progress", label: "Progress" },
];

// Routes that belong conceptually under a top-level nav item but live at
// their own path (e.g. history/study-plan are tabs within "Progress").
const ALIASES: Record<string, string[]> = {
  "/session": ["/learn"],
  "/progress": ["/history", "/study-plan"],
};

export default function NavLinks() {
  const path = usePathname();

  function isActive(href: string) {
    if (path === href || (href !== "/" && path.startsWith(href))) return true;
    return (ALIASES[href] || []).some((alias) => path.startsWith(alias));
  }

  return (
    <>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`nav-link${isActive(l.href) ? " nav-link-active" : ""}`}
        >
          {l.label}
        </Link>
      ))}
    </>
  );
}

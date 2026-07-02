"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/session", label: "Practice" },
  { href: "/progress", label: "Progress" },
  { href: "/quality", label: "Quality" },
];

// Routes that belong conceptually under a top-level nav item but live at
// their own path (e.g. history is a tab within "Progress").
const ALIASES: Record<string, string[]> = {
  "/explore": ["/browse", "/graph"],
  "/session": ["/learn"],
  "/progress": ["/history"],
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

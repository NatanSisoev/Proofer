"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/browse", label: "Browse" },
  { href: "/graph", label: "Map" },
  { href: "/session", label: "Practice" },
  { href: "/progress", label: "Progress" },
  { href: "/history", label: "History" },
  { href: "/study-plan", label: "Plan" },
  { href: "/quality", label: "Quality" },
];

export default function NavLinks() {
  const path = usePathname();

  function isActive(href: string) {
    if (href === "/session" && path.startsWith("/learn")) return true;
    return path === href || (href !== "/" && path.startsWith(href));
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

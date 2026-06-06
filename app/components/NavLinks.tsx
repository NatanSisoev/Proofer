"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/browse", label: "Browse" },
  { href: "/graph", label: "Map" },
  { href: "/flashcard", label: "Flashcards" },
  { href: "/learn", label: "Practice" },
  { href: "/session", label: "Session" },
  { href: "/progress", label: "Progress" },
  { href: "/history", label: "History" },
  { href: "/study-plan", label: "Plan" },
  { href: "/quality", label: "Quality" },
];

export default function NavLinks() {
  const path = usePathname();

  function isActive(href: string) {
    return path === href || (href !== "/" && path.startsWith(href));
  }

  return (
    <>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="nav-link"
          style={
            isActive(l.href)
              ? { color: "var(--text)", background: "var(--bg-soft)", fontWeight: 600 }
              : undefined
          }
        >
          {l.label}
        </Link>
      ))}
    </>
  );
}

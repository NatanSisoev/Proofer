import Link from "next/link";

const TABS = [
  { href: "/progress", key: "overview", label: "Overview" },
  { href: "/history", key: "history", label: "History" },
] as const;

export default function ProgressTabs({ active }: { active: "overview" | "history" }) {
  return (
    <div className="tab-bar">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`tab-link${active === t.key ? " active" : ""}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

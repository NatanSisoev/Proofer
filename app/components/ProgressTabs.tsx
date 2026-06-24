import Link from "next/link";

const TABS = [
  { href: "/progress", key: "overview", label: "Overview" },
  { href: "/history", key: "history", label: "History" },
  { href: "/study-plan", key: "plan", label: "Study plan" },
] as const;

export default function ProgressTabs({ active }: { active: "overview" | "history" | "plan" }) {
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

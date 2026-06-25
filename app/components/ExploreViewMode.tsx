"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type ViewMode = "sections" | "map" | "list";

export default function ExploreViewMode({ currentView = "sections" }: { currentView: ViewMode }) {
  const searchParams = useSearchParams();

  const views: { id: ViewMode; label: string }[] = [
    { id: "sections", label: "Sections" },
    { id: "map", label: "Map" },
    { id: "list", label: "List" },
  ];

  const getHref = (view: ViewMode) => {
    const p = new URLSearchParams(searchParams);
    p.set("view", view);
    // Clear area and q when switching views
    if (view !== "map") p.delete("area");
    if (view !== "list") p.delete("q");
    return `/explore?${p.toString()}`;
  };

  return (
    <div className="view-mode-toggle">
      {views.map((v) => (
        <Link
          key={v.id}
          href={getHref(v.id)}
          className={`view-mode-btn${currentView === v.id ? " active" : ""}`}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );
}

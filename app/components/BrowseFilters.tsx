"use client";

import { useRouter } from "next/navigation";

type Props = {
  area: string;
  activeType?: string;
  activeSort: string;
  types: string[];
};

export default function BrowseFilters({ area, activeType, activeSort, types }: Props) {
  const router = useRouter();

  function nav(params: Record<string, string | undefined>) {
    const p = new URLSearchParams({ view: "sections", area });
    if (params.type || activeType) p.set("type", params.type ?? activeType ?? "");
    if (params.sort || activeSort) p.set("sort", params.sort ?? activeSort);
    if (!p.get("type")) p.delete("type");
    router.push(`/explore?${p.toString()}`);
  }

  const sortLabels: Record<string, string> = {
    mastery_asc: "Weakest first",
    mastery_desc: "Strongest first",
    alpha: "A–Z",
  };

  return (
    <div className="browse-filters">
      <div className="filter-group">
        <button
          className={`filter-btn${!activeType ? " active" : ""}`}
          onClick={() => nav({ type: "" })}
        >
          All types
        </button>
        {types.map((t) => (
          <button
            key={t}
            className={`filter-btn${activeType === t ? " active" : ""}`}
            onClick={() => nav({ type: t })}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="filter-group">
        {(["mastery_asc", "mastery_desc", "alpha"] as const).map((s) => (
          <button
            key={s}
            className={`filter-btn${activeSort === s ? " active" : ""}`}
            onClick={() => nav({ sort: s })}
          >
            {sortLabels[s]}
          </button>
        ))}
      </div>
    </div>
  );
}

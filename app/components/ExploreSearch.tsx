"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

export default function ExploreSearch({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const p = new URLSearchParams(searchParams);
      p.set("view", "list");
      if (val) {
        p.set("q", val);
      } else {
        p.delete("q");
      }
      startTransition(() => router.push(`/explore?${p.toString()}`));
    },
    [router, searchParams]
  );

  return (
    <input
      type="search"
      placeholder="Search concepts..."
      defaultValue={defaultValue || ""}
      onChange={handleInput}
      style={{
        width: "100%",
        padding: "10px 12px",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        fontSize: "14px",
        background: "var(--panel)",
        color: "var(--text)",
      }}
    />
  );
}

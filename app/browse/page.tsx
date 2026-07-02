import { redirect } from "next/navigation";

// Old URL, kept working for bookmarks/browser history — /explore's
// "sections" view replaced this page (see IMPROVEMENT_PLAN.md P0 #1).
export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; type?: string; sort?: string }>;
}) {
  const { area, type, sort } = await searchParams;
  const params = new URLSearchParams({ view: "sections" });
  if (area) params.set("area", area);
  if (type) params.set("type", type);
  if (sort) params.set("sort", sort);
  redirect(`/explore?${params.toString()}`);
}

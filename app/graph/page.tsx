import { redirect } from "next/navigation";

// Old URL, kept working for bookmarks/browser history — /explore's "map"
// view replaced this page (see IMPROVEMENT_PLAN.md P0 #1).
export default async function GraphPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  const { area } = await searchParams;
  const params = new URLSearchParams({ view: "map" });
  if (area) params.set("area", area);
  redirect(`/explore?${params.toString()}`);
}

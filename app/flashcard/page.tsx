import FlashCards from "@/app/components/FlashCards";
import { frontier, bookmarkedNodes, weakSpots } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function FlashCardPage() {
  // Combine frontier + bookmarks + weak spots into a shuffled flashcard deck.
  // Deduplicate by id. Server-rendered so we can call queries directly.
  const front = frontier(30);
  const bookmarks = bookmarkedNodes();
  const weak = weakSpots(20);

  const seen = new Set<string>();
  const cards: { id: string; title: string; type: string | null; area: string | null; overview: string | null; content: string | null; mastery_p: number }[] = [];

  function addCard(n: { id: string; title: string; type?: string | null; area?: string | null; overview?: string | null; content?: string | null; mastery_p?: number }) {
    if (!seen.has(n.id)) {
      seen.add(n.id);
      cards.push({
        id: n.id,
        title: n.title,
        type: n.type ?? null,
        area: n.area ?? null,
        overview: n.overview ?? null,
        content: n.content ?? null,
        mastery_p: n.mastery_p ?? 0,
      });
    }
  }

  // Priority: weak spots first (need the most review), then bookmarks, then frontier
  weak.forEach(addCard);
  bookmarks.forEach(addCard);
  front.forEach(addCard);

  return <FlashCards initialCards={cards} />;
}

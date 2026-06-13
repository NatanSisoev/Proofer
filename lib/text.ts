// Truncate to at most `max` characters WITHOUT splitting an inline LaTeX span.
// A naive slice can cut through `$...$`, leaving an unbalanced `$` that breaks
// KaTeX (the formula renders as literal text). If the cut lands inside a math
// span (odd count of unescaped `$`), we back off to just before the opening
// delimiter so what remains is always renderable.
export function truncateMath(s: string, max: number): string {
  if (s.length <= max) return s;
  let cut = s.slice(0, max);
  const dollars = (cut.match(/(?<!\\)\$/g) || []).length;
  if (dollars % 2 === 1) {
    cut = cut.slice(0, cut.lastIndexOf("$"));
  }
  return cut.replace(/\s+$/, "") + "…";
}

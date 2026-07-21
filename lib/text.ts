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

/**
 * Clean an edge-context snippet for inline display.
 *
 * Contexts are raw sentences lifted straight out of Obsidian notes, so they
 * still carry vault syntax that means nothing outside the editor: `[[wikilinks]]`,
 * leading list markers, `**bold**`, and Templater proof scaffolding. `MathText`
 * renders inline LaTeX but not Obsidian markup, so without this the node page
 * shows literal "- [[Convergent Series]] — …".
 */
export function cleanContext(s: string): string {
  return s
    // Templater proof scaffolding: `\begin{proof}` / `\end{proof}`
    .replace(/`\\(?:begin|end)\{proof\}`/g, "")
    // [[Target|alias]] -> alias, [[Target#anchor]] -> Target
    .replace(/\[\[([^\]]+)\]\]/g, (_m, inner: string) => {
      const [target, alias] = inner.split("|");
      return (alias || target.split("#")[0]).trim();
    })
    // a context clipped mid-link leaves an unterminated "[[" the pattern above
    // can't match — drop any stray brackets so they never reach the page
    .replace(/\[\[|\]\]/g, "")
    .replace(/\*\*/g, "")
    // leading list marker / "Sibling:"-style bullet residue
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

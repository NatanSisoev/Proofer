import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// Turn Obsidian-flavoured note bodies into standard markdown that react-markdown
// can render: rewrite [[wikilinks]] to concept links, flatten callouts, drop
// Templater/tikz scaffolding that isn't meaningful in the graph view.
function preprocess(src: string): string {
  let s = src;
  // drop the leading H1 (the page shows the title already)
  s = s.replace(/^#\s+.*$/m, "");
  // strip tikz code fences (raw LaTeX picture source)
  s = s.replace(/```tikz[\s\S]*?```/g, "");
  // strip Templater proof scaffolding: `\begin{proof}`@[[#^X]] ... `\end{proof}`
  s = s.replace(/`\\begin\{proof\}`(@\[\[[^\]]*\]\])?/g, "_Proof._");
  s = s.replace(/`\\end\{proof\}`/g, "");
  // remove block-ref anchors like ^Definition on their own line
  s = s.replace(/^\^[\w-]+\s*$/gm, "");
  // callouts: > [!Theorem] Title  ->  > **Title**
  s = s.replace(/^(>\s*)\[!([^\]]+)\][+-]?\s*(.*)$/gm, (_m, q, type, title) => `${q}**${title || type}**`);
  // embedded notes: ![[note]] → just remove (no useful content to show)
  s = s.replace(/!\[\[[^\]]+\]\]/g, "");
  // wikilinks: [[Target|alias]] or [[Target]] → link
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_m, inner) => {
    const [targetRaw, alias] = inner.split("|");
    const target = targetRaw.split("#")[0].trim();
    const display = (alias || targetRaw.split("#")[0]).trim();
    if (!target) return display; // self-anchor
    return `[${display}](/node/${encodeURIComponent(target)})`;
  });
  // Obsidian metadata/dataview fences
  s = s.replace(/^---[\s\S]*?^---\n?/m, ""); // strip frontmatter if not already stripped
  s = s.replace(/```dataview[\s\S]*?```/g, ""); // strip dataview blocks
  return s;
}

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
      >
        {preprocess(children)}
      </ReactMarkdown>
    </div>
  );
}

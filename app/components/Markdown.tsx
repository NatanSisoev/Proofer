"use client";

// Client-side because the ```tikz override below renders <TikzFigure>, which
// needs an effect to fetch its compiled SVG. Elements created inside
// react-markdown's `components` callbacks don't form a client boundary when
// this module renders as RSC — TikzFigure ends up server-rendered and its
// effect never runs. react-markdown is already in the client bundle via
// ProblemCard, so opting the whole component in costs nothing extra.

import ReactMarkdown, { type Components, type Options } from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import TikzFigure from "./TikzFigure";

// Turn Obsidian-flavoured note bodies into standard markdown that react-markdown
// can render: rewrite [[wikilinks]] to concept links, flatten callouts, drop
// Templater scaffolding that isn't meaningful in the graph view. ```tikz fences
// are left intact — the `pre` override below compiles them to figures.
function preprocess(src: string): string {
  let s = src;
  // drop the leading H1 (the page shows the title already)
  s = s.replace(/^#\s+.*$/m, "");
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

// Defined once at module scope, not inline in the JSX: a fresh `components`
// object (or plugin array) on every render makes react-markdown rebuild its
// tree, which remounts TikzFigure and restarts its fetch in a loop.
const REMARK_PLUGINS: Options["remarkPlugins"] = [remarkMath, remarkGfm];
const REHYPE_PLUGINS: Options["rehypePlugins"] = [[rehypeKatex, { strict: false, throwOnError: false }]];
const COMPONENTS: Components = {
  // A ```tikz fence is LaTeX picture source, not code to display — swap the
  // whole <pre> for the compiled figure. Overriding `pre` rather than `code`
  // keeps the figure out of the <pre> wrapper, which may only contain
  // phrasing content.
  pre({ children: kids, ...props }) {
    const child = Array.isArray(kids) ? kids[0] : kids;
    const codeProps = (child as { props?: { className?: string; children?: unknown } } | null)?.props;
    if (typeof codeProps?.className === "string" && codeProps.className.includes("language-tikz")) {
      return <TikzFigure source={String(codeProps.children ?? "")} />;
    }
    return <pre {...props}>{kids}</pre>;
  },
};

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={COMPONENTS}>
        {preprocess(children)}
      </ReactMarkdown>
    </div>
  );
}

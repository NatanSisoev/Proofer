import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { ComponentPropsWithoutRef } from "react";

// Renders inline LaTeX ($...$) and plain text without any block formatting.
// Safe for short strings: overviews, edge contexts, subtitles.
export default function MathText({
  children,
  className,
  style,
}: {
  children: string;
  className?: string;
  style?: ComponentPropsWithoutRef<"span">["style"];
}) {
  return (
    <span className={className} style={style}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
        components={{
          // Unwrap every block-level element ReactMarkdown might emit (a
          // numbered list in a problem statement, a stray heading, etc.)
          // so the output truly never contains block markup, regardless
          // of what wrapper element the caller puts this in (often a <p>,
          // which can't legally contain <ol>/<ul>/<h1-6> and would
          // otherwise trigger a hydration mismatch).
          p: ({ children }) => <>{children}</>,
          ol: ({ children }) => <>{children}</>,
          ul: ({ children }) => <>{children}</>,
          li: ({ children }) => <>{children} </>,
          blockquote: ({ children }) => <>{children}</>,
          h1: ({ children }) => <>{children}</>,
          h2: ({ children }) => <>{children}</>,
          h3: ({ children }) => <>{children}</>,
          h4: ({ children }) => <>{children}</>,
          h5: ({ children }) => <>{children}</>,
          h6: ({ children }) => <>{children}</>,
        }}
      >
        {children}
      </ReactMarkdown>
    </span>
  );
}

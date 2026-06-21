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
          // Unwrap the paragraph ReactMarkdown adds so it stays inline
          p: ({ children }) => <>{children}</>,
        }}
      >
        {children}
      </ReactMarkdown>
    </span>
  );
}

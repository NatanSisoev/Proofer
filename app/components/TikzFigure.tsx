"use client";

import { useEffect, useState } from "react";
import Spinner from "./Spinner";

type State = { status: "loading" } | { status: "ok"; svg: string } | { status: "error"; message: string };

/**
 * Renders a ```tikz fence from a note. Compilation runs server-side (a WASM
 * TeX engine, seconds on a cache miss) via /api/tikz, which caches every
 * result — so this is slow once per distinct figure and instant thereafter.
 *
 * The SVG is injected as HTML because that is the compiler's output format.
 * It is second-hand only in the trivial sense: the source is the owner's own
 * vault note, compiled locally by TikZJax, never third-party input.
 */
export default function TikzFigure({ source }: { source: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetch("/api/tikz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.svg) setState({ status: "ok", svg: d.svg });
        else setState({ status: "error", message: d.error || "Figure could not be compiled." });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "Figure could not be compiled." });
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  if (state.status === "loading") {
    return (
      <div className="tikz-figure tikz-figure-loading">
        <Spinner label="Rendering figure…" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <details className="tikz-figure tikz-figure-error">
        <summary className="muted small">Figure could not be rendered — show source</summary>
        <pre>{source}</pre>
        <p className="muted small">{state.message}</p>
      </details>
    );
  }

  return <div className="tikz-figure" dangerouslySetInnerHTML={{ __html: state.svg }} />;
}

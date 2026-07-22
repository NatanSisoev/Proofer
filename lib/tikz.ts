import { createHash } from "node:crypto";
import { db } from "./db";

/**
 * TikZ figure rendering. Vault notes embed raw LaTeX picture source in ```tikz
 * fences; node-tikzjax compiles one to SVG via a WASM TeX engine in ~2-7s.
 * That is far too slow to redo per page view, so every result (success *and*
 * failure) is cached in `tikz_cache`, keyed by a hash of the normalised
 * source. Content-addressed, so an edited figure just misses the cache and
 * recompiles — nothing ever needs invalidating.
 */

/** Strip the callout quoting Obsidian applies to fences nested in `> [!note]` blocks. */
export function normalizeTikzSource(raw: string): string {
  let s = raw;
  if (/^\s*>/m.test(s)) s = s.replace(/^\s*>\s?/gm, "");
  s = s.trim();
  // node-tikzjax expects a full document. Vault notes normally include the
  // wrapper themselves; supply it for the bare-\begin{tikzpicture} case.
  if (!s.includes("\\begin{document}")) s = `\\begin{document}\n${s}\n\\end{document}`;
  return s;
}

export function tikzHash(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

export type TikzResult = { svg: string; error: string | null; cached: boolean };

function readCache(hash: string): { svg: string; error: string | null } | undefined {
  return db().prepare("SELECT svg, error FROM tikz_cache WHERE hash = ?").get(hash) as
    | { svg: string; error: string | null }
    | undefined;
}

// The WASM TeX engine keeps module-level state across calls, so concurrent
// compiles would interleave and corrupt each other's output. A note can hold
// several figures that all request at once — chain every render onto a single
// promise so they run strictly one at a time.
let renderChain: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const next = renderChain.then(fn, fn);
  // Keep the chain alive even when a render rejects.
  renderChain = next.catch(() => {});
  return next;
}

export async function renderTikz(rawSource: string): Promise<TikzResult> {
  const source = normalizeTikzSource(rawSource);
  const hash = tikzHash(source);

  const hit = readCache(hash);
  if (hit) return { svg: hit.svg, error: hit.error, cached: true };

  return serialize(async () => {
    // Re-check inside the lock: identical figures queued together would
    // otherwise each compile the same source.
    const raced = readCache(hash);
    if (raced) return { svg: raced.svg, error: raced.error, cached: true };

    let svg = "";
    let error: string | null = null;
    try {
      // Imported lazily so the WASM engine and its texlive dump only load in
      // processes that actually render a figure.
      const { default: tex2svg } = await import("node-tikzjax");
      svg = await tex2svg(source, { showConsole: false });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    db()
      .prepare("INSERT OR REPLACE INTO tikz_cache(hash, svg, error) VALUES (?, ?, ?)")
      .run(hash, svg, error);

    return { svg, error, cached: false };
  });
}

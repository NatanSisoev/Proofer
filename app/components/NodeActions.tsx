"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Spinner from "./Spinner";
import { ExternalLink, Sparkles, Check } from "./Icons";
import ErrorBanner from "./ErrorBanner";
import { consumeStream } from "@/lib/stream";

// Markdown pulls in katex + react-markdown + remark; defer it out of this
// component's initial chunk since it only renders after "Explain this" is clicked.
const Markdown = dynamic(() => import("./Markdown"));

type Props = {
  nodeId: string;
  nodePath: string | null;
  hasLLM: boolean;
};

type ImproveState = "idle" | "loading" | "preview" | "applying" | "done" | "error";

export default function NodeActions({ nodeId, nodePath, hasLLM }: Props) {
  const [improveState, setImproveState] = useState<ImproveState>("idle");
  const [preview, setPreview] = useState<string>("");
  const [improveError, setImproveError] = useState<string>("");

  const [explanation, setExplanation] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string>("");

  const obsidianHref = nodePath
    ? `obsidian://open?path=${encodeURIComponent(nodePath)}`
    : null;

  async function handleExplain() {
    if (explanation) { setExplanation(null); return; } // toggle off
    setExplainLoading(true);
    setExplainError("");
    try {
      const res = await fetch(`/api/node/${encodeURIComponent(nodeId)}/explain`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to explain");
      }
      setExplanation(""); // clear the spinner as soon as the first chunk can render
      await consumeStream(res, setExplanation);
    } catch (e: any) {
      setExplainError(e.message);
    } finally {
      setExplainLoading(false);
    }
  }

  async function handleImprove() {
    setImproveState("loading");
    setImproveError("");
    try {
      const res = await fetch(`/api/node/${encodeURIComponent(nodeId)}/improve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to improve note");
      setPreview(data.improved);
      setImproveState("preview");
    } catch (e: any) {
      setImproveError(e.message);
      setImproveState("error");
    }
  }

  async function handleApply() {
    setImproveState("applying");
    try {
      const res = await fetch(`/api/node/${encodeURIComponent(nodeId)}/improve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true, content: preview }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to apply");
      }
      setImproveState("done");
    } catch (e: any) {
      setImproveError(e.message);
      setImproveState("error");
    }
  }

  return (
    <div className="actions-col">
      <div className="action-row">
        {obsidianHref && (
          <a href={obsidianHref} className="btn-ghost btn-sm icon-label">
            Open in Obsidian <ExternalLink size={13} />
          </a>
        )}
        {hasLLM && (
          <button
            onClick={handleExplain}
            className="btn-ghost btn-sm"
            disabled={explainLoading}
          >
            {explainLoading ? <Spinner label="Thinking…" /> : explanation ? "Hide explanation" : (
              <span className="icon-label">Explain this <Sparkles size={13} /></span>
            )}
          </button>
        )}
        {hasLLM && nodePath && (
          <button
            onClick={handleImprove}
            className="btn-ghost btn-sm"
            disabled={improveState === "loading" || improveState === "applying"}
          >
            {improveState === "loading" ? <Spinner label="Thinking…" /> : "Improve note"}
          </button>
        )}
      </div>

      {explainError && <ErrorBanner>{explainError}</ErrorBanner>}

      {explanation && (
        <div className="panel explain-panel">
          <h2 className="explain-heading">AI explanation</h2>
          <div className="markdown"><Markdown>{explanation}</Markdown></div>
        </div>
      )}

      {improveState === "error" && <ErrorBanner>{improveError}</ErrorBanner>}

      {improveState === "done" && (
        <p className="action-success icon-label"><Check size={13} /> Note updated in Obsidian. Re-sync vault to refresh.</p>
      )}

      {improveState === "preview" && preview && (
        <div className="panel" style={{ marginTop: 4 }}>
          <div className="panel-header">
            <h2>AI improvement preview</h2>
            <span className="muted small">Review before applying</span>
          </div>
          <pre className="code-preview">{preview}</pre>
          <div className="confirm-row">
            <button onClick={handleApply} className="btn-primary btn-sm">
              Apply to Obsidian
            </button>
            <button onClick={() => setImproveState("idle")} className="btn-ghost btn-sm">
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

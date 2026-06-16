"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type { RelatedEdge } from "@/lib/queries";

type EdgeClassification = {
  src_id: string; tgt_id: string;
  suggested_type: string; confidence: number; reasoning: string;
};

type EdgeState = RelatedEdge & {
  suggestion?: EdgeClassification;
  classifying?: boolean;
  retying?: boolean;
  done?: boolean;
  error?: string;
};

const TYPE_OPTIONS = [
  { value: "depends_on",    label: "depends on",    desc: "A requires B as a prerequisite" },
  { value: "generalizes",   label: "generalizes",   desc: "B is a special case of A" },
  { value: "equivalent_to", label: "equivalent to", desc: "A and B are the same concept" },
  { value: "instance_of",   label: "instance of",   desc: "A is a concrete example of B" },
  { value: "contradicts",   label: "contradicts",   desc: "A refutes or limits B" },
  { value: "related",       label: "keep as related", desc: "No stronger type applies" },
];

const CONFIDENCE_COLOR = (c: number) =>
  c >= 0.8 ? "var(--green)" : c >= 0.5 ? "var(--amber)" : "var(--muted)";

export default function RelatedEdges({ initial, hasKey }: { initial: RelatedEdge[]; hasKey: boolean }) {
  const [edges, setEdges] = useState<EdgeState[]>(initial);
  const [classifyingAll, setClassifyingAll] = useState(false);
  const [classifyAllError, setClassifyAllError] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState(10);

  const updateEdge = useCallback((src: string, tgt: string, patch: Partial<EdgeState>) => {
    setEdges((prev) => prev.map((e) => e.src_id === src && e.tgt_id === tgt ? { ...e, ...patch } : e));
  }, []);

  async function retypeEdge(src: string, tgt: string, newType: string) {
    updateEdge(src, tgt, { retying: true, error: undefined });
    try {
      const res = await fetch("/api/quality/edges/retype", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src, dst: tgt, newType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to retype");
      updateEdge(src, tgt, { done: true, retying: false });
    } catch (e: any) {
      updateEdge(src, tgt, { retying: false, error: e.message || "Failed" });
    }
  }

  async function classifyBatch(batch: EdgeState[]) {
    if (!hasKey || batch.length === 0) return;
    setClassifyingAll(true);
    setClassifyAllError(null);

    // Mark all as classifying
    batch.forEach((e) => updateEdge(e.src_id, e.tgt_id, { classifying: true }));

    try {
      const res = await fetch("/api/quality/edges/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edges: batch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Classification failed");
      for (const r of data.results ?? []) {
        updateEdge(r.src_id, r.tgt_id, { classifying: false, suggestion: r });
      }
      if (data.failures > 0) {
        setClassifyAllError(`${data.failures} edge(s) could not be classified.`);
      }
    } catch (e: any) {
      batch.forEach((e) => updateEdge(e.src_id, e.tgt_id, { classifying: false }));
      setClassifyAllError(e.message || "Classification failed");
    } finally {
      setClassifyingAll(false);
    }
  }

  const visible = edges.filter((e) => !e.done);
  const done = edges.filter((e) => e.done).length;
  const withSuggestions = visible.filter((e) => e.suggestion);
  const notYetClassified = visible.filter((e) => !e.suggestion && !e.classifying);

  return (
    <div>
      {/* Header / actions */}
      <div className="edge-header">
        <div>
          <span style={{ fontWeight: 600 }}>{visible.length}</span>
          <span className="muted"> unclassified edge{visible.length !== 1 ? "s" : ""}</span>
          {done > 0 && <span className="muted"> · {done} reclassified this session</span>}
        </div>

        {hasKey && notYetClassified.length > 0 && (
          <div className="edge-actions">
            <label className="muted" style={{ fontSize: 13 }}>
              Batch size:
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="field-select"
                style={{ marginLeft: 6 }}
              >
                {[5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button
              className="pill pill-accent" style={{ cursor: "pointer" }}
              disabled={classifyingAll}
              onClick={() => classifyBatch(notYetClassified.slice(0, batchSize))}
            >
              {classifyingAll ? "Classifying…" : `AI classify next ${Math.min(batchSize, notYetClassified.length)} →`}
            </button>
          </div>
        )}
        {!hasKey && (
          <span className="muted small" style={{ marginLeft: "auto" }}>
            Add GEMINI_API_KEY or ANTHROPIC_API_KEY to enable AI suggestions.
          </span>
        )}
      </div>

      {classifyAllError && (
        <p className="muted small error-text">{classifyAllError}</p>
      )}

      {visible.length === 0 && (
        <p className="muted empty-state">
          All related edges have been reclassified. ✓
        </p>
      )}

      <div className="flex-col" style={{ gap: 10 }}>
        {visible.map((e) => (
          <EdgeRow
            key={`${e.src_id}|${e.tgt_id}`}
            edge={e}
            onRetype={retypeEdge}
            onClassifySingle={() => classifyBatch([e])}
            hasKey={hasKey}
          />
        ))}
      </div>
    </div>
  );
}

function EdgeRow({
  edge, onRetype, onClassifySingle, hasKey,
}: {
  edge: EdgeState;
  onRetype: (src: string, tgt: string, type: string) => void;
  onClassifySingle: () => void;
  hasKey: boolean;
}) {
  const [selected, setSelected] = useState<string>(edge.suggestion?.suggested_type ?? "related");

  // Update selected when suggestion arrives
  if (edge.suggestion && selected === "related" && edge.suggestion.suggested_type !== "related") {
    setSelected(edge.suggestion.suggested_type);
  }

  return (
    <div className="edge-card">
      {/* Concept pair */}
      <div className="edge-pair">
        <Link href={`/node/${encodeURIComponent(edge.src_id)}`} className="concept-link text-link">
          {edge.src_title}
        </Link>
        {edge.src_type && <span className={`type-badge t-${edge.src_type}`}>{edge.src_type}</span>}
        <span className="muted" style={{ fontSize: 12 }}>→ related →</span>
        <Link href={`/node/${encodeURIComponent(edge.tgt_id)}`} className="concept-link text-link">
          {edge.tgt_title}
        </Link>
        {edge.tgt_type && <span className={`type-badge t-${edge.tgt_type}`}>{edge.tgt_type}</span>}
        {edge.src_area && edge.tgt_area && edge.src_area !== edge.tgt_area && (
          <span className="muted small">({edge.src_area} / {edge.tgt_area})</span>
        )}
        {edge.src_area && edge.src_area === edge.tgt_area && (
          <span className="muted small">({edge.src_area})</span>
        )}
      </div>

      {/* Context snippet */}
      {edge.context && (
        <p className="muted small italic-note">"{edge.context}"</p>
      )}

      {/* AI suggestion */}
      {edge.classifying && (
        <p className="muted small" style={{ margin: 0 }}>Classifying…</p>
      )}
      {edge.suggestion && (
        <div className="ai-suggestion">
          <span className="muted">AI suggests:</span>
          <span className="ai-suggest-type">
            {edge.suggestion.suggested_type.replace(/_/g, " ")}
          </span>
          <span style={{ color: CONFIDENCE_COLOR(edge.suggestion.confidence) }}>
            ({Math.round(edge.suggestion.confidence * 100)}% confidence)
          </span>
          <span className="muted small" style={{ marginLeft: 4 }}>— {edge.suggestion.reasoning}</span>
        </div>
      )}

      {/* Action row */}
      <div className="edge-action-row">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="field-select"
          disabled={edge.retying}
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>
          ))}
        </select>

        <button
          className={`pill ${selected === "related" ? "pill-muted" : "pill-accent"}`}
          style={{ cursor: edge.retying ? "default" : "pointer" }}
          disabled={edge.retying || selected === "related"}
          onClick={() => onRetype(edge.src_id, edge.tgt_id, selected)}
          title={selected === "related" ? "Choose a more specific type first" : `Retype as "${selected}"`}
        >
          {edge.retying ? "Saving…" : "Apply →"}
        </button>

        {hasKey && !edge.suggestion && !edge.classifying && (
          <button
            className="pill pill-muted"
            onClick={onClassifySingle}
          >
            AI suggest
          </button>
        )}

        {edge.error && <span className="error-inline">{edge.error}</span>}
      </div>
    </div>
  );
}

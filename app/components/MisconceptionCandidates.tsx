"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type { MisconceptionCandidate } from "@/lib/queries";
import MathText from "./MathText";
import { Check, ArrowRight, Lightbulb } from "./Icons";
import ErrorBanner from "./ErrorBanner";
import EmptyState from "./EmptyState";

type Cluster = { label: string; gap_count: number };

type CandidateState = MisconceptionCandidate & {
  analyzing?: boolean;
  saving?: boolean;
  clusters?: Cluster[];
  gapsAnalyzed?: number;
  saved?: boolean;
  error?: string;
};

export default function MisconceptionCandidates({ initial, hasKey }: { initial: MisconceptionCandidate[]; hasKey: boolean }) {
  const [candidates, setCandidates] = useState<CandidateState[]>(initial);

  const updateCandidate = useCallback((id: string, patch: Partial<CandidateState>) => {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  async function analyze(id: string) {
    updateCandidate(id, { analyzing: true, error: undefined, saved: false });
    try {
      const res = await fetch("/api/quality/misconceptions/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      updateCandidate(id, { analyzing: false, clusters: data.clusters, gapsAnalyzed: data.gapsAnalyzed });
    } catch (e: any) {
      updateCandidate(id, { analyzing: false, error: e.message || "Analysis failed" });
    }
  }

  async function save(id: string, clusters: Cluster[]) {
    updateCandidate(id, { saving: true, error: undefined });
    try {
      const res = await fetch("/api/quality/misconceptions/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: id, clusters }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      updateCandidate(id, { saving: false, saved: true, existing_count: clusters.length });
    } catch (e: any) {
      updateCandidate(id, { saving: false, error: e.message || "Save failed" });
    }
  }

  if (candidates.length === 0) {
    return (
      <EmptyState icon={<Lightbulb size={18} />}>
        No concept has enough failed/partial attempts yet (need at least 2) to look for a
        recurring misconception. This grows as you practice.
      </EmptyState>
    );
  }

  return (
    <div className="flex-col" style={{ gap: 10 }}>
      {candidates.map((c) => (
        <div key={c.id} className="edge-card">
          <div className="edge-pair">
            <Link href={`/node/${encodeURIComponent(c.id)}`} className="concept-link text-link">
              <MathText>{c.title}</MathText>
            </Link>
            {c.type && <span className={`type-badge t-${c.type}`}>{c.type}</span>}
            {c.area && <span className="muted small">{c.area}</span>}
            <span className="muted small">{c.gap_count} gap{c.gap_count !== 1 ? "s" : ""}</span>
            {c.existing_count > 0 && !c.clusters && (
              <span className="pill pill-muted label-xs">{c.existing_count} saved</span>
            )}
          </div>

          {c.analyzing && <p className="muted small" style={{ margin: 0 }}>Analyzing…</p>}

          {c.clusters && (
            c.clusters.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>
                No recurring misconception found across {c.gapsAnalyzed} gap{c.gapsAnalyzed !== 1 ? "s" : ""} — they&rsquo;re each different.
              </p>
            ) : (
              <div className="flex-col" style={{ gap: 4 }}>
                {c.clusters.map((cl, i) => (
                  <div key={i} className="ai-suggestion">
                    <span className="ai-suggest-type">{cl.label}</span>
                    <span className="muted small">— {cl.gap_count} of {c.gapsAnalyzed} gaps</span>
                  </div>
                ))}
              </div>
            )
          )}

          {c.error && <ErrorBanner>{c.error}</ErrorBanner>}

          <div className="edge-action-row">
            {!c.clusters && (
              <button className="pill pill-accent" disabled={!hasKey || c.analyzing} onClick={() => analyze(c.id)}>
                {c.analyzing ? "Analyzing…" : "AI analyze"}
              </button>
            )}
            {c.clusters && c.clusters.length > 0 && !c.saved && (
              <button className="pill pill-accent" disabled={c.saving} onClick={() => save(c.id, c.clusters!)}>
                {c.saving ? "Saving…" : <span className="icon-label">Save {c.clusters.length} cluster{c.clusters.length !== 1 ? "s" : ""} <ArrowRight size={12} /></span>}
              </button>
            )}
            {c.clusters && (
              <button className="pill pill-muted" disabled={c.analyzing} onClick={() => analyze(c.id)}>
                Re-analyze
              </button>
            )}
            {c.saved && (
              <span className="muted small icon-label">Saved <Check size={12} /></span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

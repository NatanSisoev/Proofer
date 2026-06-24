"use client";

import { useState } from "react";
import Link from "next/link";
import type { QualityIssue } from "@/lib/queries";
import { ArrowRight, ChevronUp, ChevronDown } from "./Icons";

const ISSUE_COLOR: Record<string, string> = {
  "no content": "var(--red)",
  "thin content": "var(--amber)",
  "no overview": "var(--amber)",
  "no prerequisites": "var(--purple)",
  "isolated": "var(--muted)",
  "never practiced": "var(--accent)",
};

// "never practiced" is informational — keep it separate from structural issues
const STRUCTURAL_ISSUES = ["no content", "thin content", "no overview", "no prerequisites", "isolated"];

export default function QualityFilters({
  issues,
  allIssueTypes,
}: {
  issues: QualityIssue[];
  allIssueTypes: string[];
}) {
  const [filter, setFilter] = useState<string | null>(null);
  const [showPractice, setShowPractice] = useState(false);

  const structuralOnly = issues.filter((n) =>
    n.issues.some((i) => STRUCTURAL_ISSUES.includes(i))
  );
  const practiceOnly = issues.filter(
    (n) => n.issues.length === 1 && n.issues[0] === "never practiced"
  );

  const structuralIssueTypes = allIssueTypes.filter((t) => STRUCTURAL_ISSUES.includes(t));

  const baseList = filter
    ? issues.filter((n) => n.issues.includes(filter))
    : structuralOnly;

  return (
    <div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <h2>Filter by issue</h2>
        <div className="chips-row">
          <button
            onClick={() => setFilter(null)}
            style={{
              fontSize: 12, padding: "4px 10px",
              background: filter === null ? "var(--accent-soft)" : "transparent",
              border: `1px solid ${filter === null ? "var(--accent)" : "var(--border)"}`,
              color: filter === null ? "var(--accent)" : "var(--muted)",
              borderRadius: 20, cursor: "pointer",
            }}
          >
            Structural ({structuralOnly.length})
          </button>
          {structuralIssueTypes.map((t) => {
            const count = issues.filter((n) => n.issues.includes(t)).length;
            return (
              <button
                key={t}
                onClick={() => setFilter(filter === t ? null : t)}
                style={{
                  fontSize: 12, padding: "4px 10px",
                  background: filter === t ? (ISSUE_COLOR[t] ?? "var(--accent)") + "22" : "transparent",
                  border: `1px solid ${filter === t ? (ISSUE_COLOR[t] ?? "var(--accent)") : "var(--border)"}`,
                  color: filter === t ? (ISSUE_COLOR[t] ?? "var(--accent)") : "var(--muted)",
                  borderRadius: 20, cursor: "pointer",
                }}
              >
                {t} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2>
          {filter ? `"${filter}" — ${baseList.length}` : `Structural issues — ${structuralOnly.length}`}
        </h2>
        {baseList.length === 0 && <p className="muted">No structural issues found.</p>}
        <div className="quality-list">
          {baseList.map((n) => (
            <div key={n.node_id} className="quality-row">
              <div className="flex-fill">
                {n.type && <span className={`type-badge t-${n.type}`} style={{ marginRight: 8 }}>{n.type}</span>}
                <Link href={`/node/${encodeURIComponent(n.node_id)}`} className="node-link">
                  {n.title}
                </Link>
                {n.area && <span className="muted small"> · {n.area}</span>}
              </div>
              <div className="issue-pills">
                {n.issues.filter((i) => i !== "never practiced").map((issue) => (
                  <span
                    key={issue}
                    className="pill"
                    onClick={() => setFilter(issue === filter ? null : issue)}
                    style={{
                      color: ISSUE_COLOR[issue] ?? "var(--muted)",
                      borderColor: "transparent",
                      background: "var(--bg-soft)",
                      fontSize: 11,
                      cursor: "pointer",
                      opacity: filter && filter !== issue ? 0.4 : 1,
                    }}
                  >
                    {issue}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Practice gaps — collapsed by default since it's expected for a new user */}
      <div className="panel">
        <button
          onClick={() => setShowPractice((s) => !s)}
          className="collapse-btn"
        >
          <span>Practice gaps — {practiceOnly.length} never-practiced notes</span>
          {showPractice ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showPractice && (
          <div className="accordion-fade" style={{ marginTop: 12 }}>
            <p className="muted small quality-hint">
              Notes with no structural issues but not yet practiced. Start a Smart session to work through these.
            </p>
            <div className="quality-list">
              {practiceOnly.map((n) => (
                <div key={n.node_id} className="quality-row">
                  <div className="flex-fill">
                    {n.type && <span className={`type-badge t-${n.type}`} style={{ marginRight: 8 }}>{n.type}</span>}
                    <Link href={`/node/${encodeURIComponent(n.node_id)}`} className="node-link">
                      {n.title}
                    </Link>
                    {n.area && <span className="muted small"> · {n.area}</span>}
                  </div>
                  <Link
                    href={`/learn?node=${encodeURIComponent(n.node_id)}`}
                    className="pill pill-accent icon-label"
                    style={{ fontSize: 11 }}
                  >
                    practice <ArrowRight size={11} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

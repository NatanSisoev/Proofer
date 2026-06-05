"use client";

import { useState } from "react";
import Link from "next/link";
import type { QualityIssue } from "@/lib/queries";

const ISSUE_COLOR: Record<string, string> = {
  "no content": "#ff6b6b",
  "thin content": "#f2a94c",
  "no overview": "#f2c94c",
  "no prerequisites": "#b794f6",
  "isolated": "#8a99b3",
  "never practiced": "#4a7aaa",
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {baseList.map((n) => (
            <div key={n.node_id} className="quality-row">
              <div style={{ minWidth: 0, flex: 1 }}>
                {n.type && <span className={`type-badge t-${n.type}`} style={{ marginRight: 8 }}>{n.type}</span>}
                <Link href={`/node/${encodeURIComponent(n.node_id)}`} style={{ color: "var(--text)", fontWeight: 500 }}>
                  {n.title}
                </Link>
                {n.area && <span className="muted small"> · {n.area}</span>}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" }}>
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
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            width: "100%", background: "none", border: "none", cursor: "pointer",
            color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em",
            fontWeight: 600, padding: 0,
          }}
        >
          <span>Practice gaps — {practiceOnly.length} never-practiced notes</span>
          <span>{showPractice ? "▲" : "▼"}</span>
        </button>
        {showPractice && (
          <div style={{ marginTop: 12 }}>
            <p className="muted small" style={{ marginTop: 0, marginBottom: 10 }}>
              Notes with no structural issues but not yet practiced. Start a Smart session to work through these.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {practiceOnly.map((n) => (
                <div key={n.node_id} className="quality-row">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {n.type && <span className={`type-badge t-${n.type}`} style={{ marginRight: 8 }}>{n.type}</span>}
                    <Link href={`/node/${encodeURIComponent(n.node_id)}`} style={{ color: "var(--text)", fontWeight: 500 }}>
                      {n.title}
                    </Link>
                    {n.area && <span className="muted small"> · {n.area}</span>}
                  </div>
                  <Link
                    href={`/learn?node=${encodeURIComponent(n.node_id)}`}
                    className="pill"
                    style={{ color: "var(--accent)", borderColor: "var(--accent-soft)", fontSize: 11 }}
                  >
                    practice →
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

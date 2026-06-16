import Link from "next/link";
import { attemptHistory, attemptKinds, browseAreas } from "@/lib/queries";
import { VERDICT, type Verdict } from "@/lib/verdict";
import HistoryAreaFilter from "@/app/components/HistoryAreaFilter";
import MathText from "@/app/components/MathText";
import { truncateMath } from "@/lib/text";

export const dynamic = "force-dynamic";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 30) return new Date(iso).toLocaleDateString();
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ verdict?: string; area?: string; kind?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const verdict = sp.verdict || "";
  const area    = sp.area    || "";
  const kind    = sp.kind    || "";
  const page    = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const perPage = 25;

  const { rows, total } = attemptHistory({
    verdict: verdict || undefined,
    area:    area    || undefined,
    kind:    kind    || undefined,
    page,
    perPage,
  });

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const areas = browseAreas().map((a) => a.area);
  const kinds = attemptKinds();

  function buildUrl(overrides: Record<string, string | number>) {
    const p: Record<string, string> = { verdict, area, kind };
    if (page > 1) p.page = String(page);
    Object.assign(p, overrides);
    const q = Object.entries(p)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return `/history${q ? "?" + q : ""}`;
  }

  const filterLink = (key: string, val: string) =>
    buildUrl({ [key]: val, page: 1 });

  return (
    <div className="wrap">
      <div className="page-top" style={{ marginBottom: 20 }}>
        <div>
          <h1>Practice history</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            {total.toLocaleString()} attempt{total !== 1 ? "s" : ""} total
          </p>
        </div>
        <Link href="/progress" className="muted small">← progress</Link>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        {/* Verdict filter */}
        <div className="filter-group">
          <span className="muted small" style={{ fontSize: 11 }}>result:</span>
          {["", "correct", "partial", "incorrect"].map((v) => (
            <Link
              key={v || "all"}
              href={filterLink("verdict", v)}
              className={verdict === v ? "btn-primary btn-xs" : "btn-ghost btn-xs"}
              style={{ color: !v ? undefined : VERDICT[v as Verdict]?.color }}
            >
              {v ? VERDICT[v as Verdict]?.short : "all"}
            </Link>
          ))}
        </div>

        {/* Kind filter */}
        {kinds.length > 0 && (
          <div className="filter-group">
            <span className="muted small" style={{ fontSize: 11 }}>kind:</span>
            <Link
              href={filterLink("kind", "")}
              className={!kind ? "btn-primary btn-xs" : "btn-ghost btn-xs"}
            >
              all
            </Link>
            {kinds.map((k) => (
              <Link
                key={k}
                href={filterLink("kind", k)}
                className={kind === k ? "btn-primary btn-xs" : "btn-ghost btn-xs"}
              >
                {k}
              </Link>
            ))}
          </div>
        )}

        {/* Area filter (select dropdown for space) */}
        {areas.length > 0 && (
          <HistoryAreaFilter areas={areas} area={area} verdict={verdict} kind={kind} />
        )}

        {/* Clear filters */}
        {(verdict || area || kind) && (
          <Link href="/history" className="muted small filter-clear">
            clear
          </Link>
        )}
      </div>

      {/* Results */}
      {rows.length === 0 ? (
        <div className="panel muted">No attempts match these filters.</div>
      ) : (
        <div className="flex-col" style={{ gap: 8 }}>
          {rows.map((a) => (
            <div
              key={a.id}
              className="panel"
              style={{
                padding: "12px 16px",
                borderLeftWidth: 3,
                borderLeftColor: VERDICT[a.verdict as Verdict]?.color || "var(--border)",
                background: VERDICT[a.verdict as Verdict]?.bg || "var(--bg-soft)",
              }}
            >
              <div className="attempt-row-header">
                <div className="attempt-row-left">
                  <span className="verdict-label" style={{ color: VERDICT[a.verdict as Verdict]?.color }}>
                    {VERDICT[a.verdict as Verdict]?.short || a.verdict}
                  </span>
                  {a.kind && (
                    <span className="pill" style={{ fontSize: 10 }}>{a.kind}</span>
                  )}
                  {a.title ? (
                    <Link href={`/node/${encodeURIComponent(a.node_id)}`} className="concept-link">
                      {a.title}
                    </Link>
                  ) : (
                    <span className="muted small">{a.node_id}</span>
                  )}
                  {a.area && (
                    <Link href={filterLink("area", a.area)} className="muted small" style={{ fontSize: 11 }}>
                      {a.area}
                    </Link>
                  )}
                </div>
                <div className="attempt-row-right">
                  <span className="muted small" style={{ fontSize: 11 }}>{timeAgo(a.created_at)}</span>
                  <Link
                    href={`/learn?node=${encodeURIComponent(a.node_id)}`}
                    className="pill pill-accent"
                    style={{ fontSize: 11 }}
                  >
                    practice →
                  </Link>
                </div>
              </div>

              {a.problem && (
                <p className="problem-text">
                  <MathText>{truncateMath(a.problem, 240)}</MathText>
                </p>
              )}

              {a.gap && a.gap !== "none" && a.gap !== "(gave up — showed answer)" && (
                <p className="muted small gap-text">
                  Gap: <MathText>{truncateMath(a.gap, 150)}</MathText>
                </p>
              )}
              {a.gap === "(gave up — showed answer)" && (
                <p className="muted small gap-text">
                  Viewed answer
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          {page > 1 && (
            <Link href={buildUrl({ page: page - 1 })} className="btn-ghost" style={{ fontSize: 13 }}>
              ← prev
            </Link>
          )}
          <span className="muted small">
            page {page} of {totalPages} · {total} total
          </span>
          {page < totalPages && (
            <Link href={buildUrl({ page: page + 1 })} className="btn-ghost" style={{ fontSize: 13 }}>
              next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

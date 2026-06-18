"use client";

// The area filter auto-submits its form on change. An onChange handler can't
// live in a Server Component (Next throws "Event handlers cannot be passed to
// Client Component props"), which was crashing the whole /history page — so
// the interactive form lives here, in a Client Component.
export default function HistoryAreaFilter({
  areas,
  area,
  verdict,
  kind,
}: {
  areas: string[];
  area: string;
  verdict?: string;
  kind?: string;
}) {
  return (
    <form method="GET" action="/history" className="filter-form">
      {verdict && <input type="hidden" name="verdict" value={verdict} />}
      {kind && <input type="hidden" name="kind" value={kind} />}
      <input type="hidden" name="page" value="1" />
      <span className="muted small" style={{ fontSize: 11 }}>area:</span>
      <select
        name="area"
        defaultValue={area}
        onChange={(e) => (e.target.form as HTMLFormElement).submit()}
      >
        <option value="">all areas</option>
        {areas.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <noscript>
        <button type="submit" className="btn-ghost" style={{ fontSize: 12, padding: "3px 8px" }}>Go</button>
      </noscript>
    </form>
  );
}

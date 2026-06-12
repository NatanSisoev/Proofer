export function SkelLine({ width, style }: { width?: string | number; style?: React.CSSProperties }) {
  return <span className="skel skel-line" style={{ width, ...style }} />;
}

export function SkelStatRow({ count = 5 }: { count?: number }) {
  return (
    <div className="stat-row">
      {Array.from({ length: count }).map((_, i) => (
        <div className="skel skel-stat" key={i} />
      ))}
    </div>
  );
}

export function SkelPanel({ lines = 3, title = true }: { lines?: number; title?: boolean }) {
  return (
    <div className="panel">
      {title && <div className="skel skel-panel-title" />}
      {Array.from({ length: lines }).map((_, i) => (
        <SkelLine key={i} width={i === lines - 1 ? "60%" : "100%"} />
      ))}
    </div>
  );
}

export function SkelHeader({ withCta = false }: { withCta?: boolean }) {
  return (
    <header className="top" style={{ borderBottom: "none", paddingBottom: 20 }}>
      <div>
        <div className="skel skel-title" />
        <div className="skel skel-tag" />
      </div>
      {withCta && <span style={{ marginLeft: "auto", flexShrink: 0 }}><div className="skel" style={{ width: 140, height: 36, borderRadius: 8 }} /></span>}
    </header>
  );
}

export function SkelPage({ panels = 3, lines = 4, withCta = false, stats = true }: {
  panels?: number;
  lines?: number;
  withCta?: boolean;
  stats?: boolean;
}) {
  return (
    <div className="wrap">
      <SkelHeader withCta={withCta} />
      {stats && <SkelStatRow />}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: stats ? 20 : 0 }}>
        {Array.from({ length: panels }).map((_, i) => (
          <SkelPanel key={i} lines={lines} />
        ))}
      </div>
    </div>
  );
}

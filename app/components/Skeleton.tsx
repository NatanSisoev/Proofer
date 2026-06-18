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
    <header className="top skel-header-flat">
      <div>
        <div className="skel skel-title" />
        <div className="skel skel-tag" />
      </div>
      {withCta && <span className="skel-cta-spacer"><div className="skel skel-cta-box" /></span>}
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
      <div className="skel-col" style={{ marginTop: stats ? 20 : 0 }}>
        {Array.from({ length: panels }).map((_, i) => (
          <SkelPanel key={i} lines={lines} />
        ))}
      </div>
    </div>
  );
}

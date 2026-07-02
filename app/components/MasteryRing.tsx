// A circular mastery indicator (replaces the old linear bar + percent for a
// concept). Colored by level — green when mastered, amber in progress, muted
// when untouched — with the percentage centered inside the ring.
export default function MasteryRing({ p, size = 38 }: { p: number; size?: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, p)) * 100);
  const stroke = size <= 30 ? 3 : 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = pct >= 80 ? "var(--green)" : pct > 0 ? "var(--amber)" : "var(--muted)";
  return (
    <span
      className="mastery-ring"
      style={{ width: size, height: size }}
      title={`${pct}% mastery`}
      aria-label={`${pct}% mastery`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-soft)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
        <text
          x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
          fill={color} style={{ fontSize: Math.round(size * 0.32), fontWeight: 700 }}
        >
          {pct}
        </text>
      </svg>
    </span>
  );
}

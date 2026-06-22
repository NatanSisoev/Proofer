// Server component — renders an inline SVG sparkline from mastery history.
import { masteryHistory } from "@/lib/queries";

const W = 120;
const H = 36;
const PAD = 3;

export default function MasterySparkline({ nodeId }: { nodeId: string }) {
  const history = masteryHistory(nodeId, 40);
  if (history.length < 2) return null;

  const pts = history.map((h, i) => ({
    x: PAD + (i / (history.length - 1)) * (W - PAD * 2),
    y: PAD + (1 - h.p) * (H - PAD * 2),
    p: h.p,
  }));

  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  // Area fill path (close to bottom)
  const fill = `${d} L ${pts[pts.length - 1].x.toFixed(1)} ${H - PAD} L ${pts[0].x.toFixed(1)} ${H - PAD} Z`;

  const latest = pts[pts.length - 1];
  const color = latest.p >= 0.8 ? "var(--green)" : latest.p >= 0.4 ? "var(--amber)" : "var(--red)";

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="sparkline-svg"
      aria-label={`Mastery history: ${history.length} data points`}
    >
      <path d={fill} fill={color} opacity={0.12} />
      <path d={d} stroke={color} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={latest.x} cy={latest.y} r={2.5} fill={color} />
    </svg>
  );
}

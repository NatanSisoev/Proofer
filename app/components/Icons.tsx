// Shared icon set, built on lucide-react (https://lucide.dev) — a consistent,
// professionally designed stroke-icon family. Re-exported through this file
// (rather than imported directly at call sites) so the default size/props
// stay consistent app-wide and call sites don't need to change if the
// underlying icon library ever does.
import {
  ArrowRight as LArrowRight,
  ArrowLeft as LArrowLeft,
  ArrowUp as LArrowUp,
  ArrowDown as LArrowDown,
  ArrowLeftRight as LArrowLeftRight,
  ChevronUp as LChevronUp,
  ChevronDown as LChevronDown,
  Check as LCheck,
  X as LX,
  Star as LStar,
  Sparkles as LSparkles,
  Mic as LMic,
  Search as LSearch,
  RefreshCw as LRefreshCw,
  Scale as LScale,
  Copy as LCopy,
  Dices as LDices,
  Lightbulb as LLightbulb,
  Triangle as LTriangle,
  Palette as LPalette,
  BookOpen as LBookOpen,
  Hash as LHash,
  ExternalLink as LExternalLink,
  Download as LDownload,
  Moon as LMoon,
  Sun as LSun,
  Plus as LPlus,
  Minus as LMinus,
  Pencil as LPencil,
  HelpCircle as LHelpCircle,
  type LucideIcon,
} from "lucide-react";

export type IconProps = { size?: number; className?: string; style?: React.CSSProperties };

/** Wraps a lucide icon with our app-wide default size (lucide defaults to 24; our UI runs smaller). */
function wrap(Lucide: LucideIcon, defaultSize = 14) {
  return function WrappedIcon({ size = defaultSize, className, style }: IconProps) {
    return <Lucide size={size} className={className} style={style} />;
  };
}

/** Small ring progress indicator, like Claude desktop's context-window meter. */
export function CircularProgress({
  value, size = 22, strokeWidth = 2.5, className, style,
}: { value: number; size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} style={style}>
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--border)" strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--accent-strong)" strokeWidth={strokeWidth}
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
    </svg>
  );
}

export const ArrowRight = wrap(LArrowRight);
export const ArrowLeft = wrap(LArrowLeft);
export const ArrowUp = wrap(LArrowUp);
export const ArrowDown = wrap(LArrowDown);
export const ArrowLeftRight = wrap(LArrowLeftRight);
export const ChevronUp = wrap(LChevronUp);
export const ChevronDown = wrap(LChevronDown);
export const Check = wrap(LCheck);
export const X = wrap(LX);
export const Sparkles = wrap(LSparkles);
export const Mic = wrap(LMic);
export const Search = wrap(LSearch);
export const RefreshCw = wrap(LRefreshCw);
export const Scale = wrap(LScale);
export const Copy = wrap(LCopy);
export const Dice = wrap(LDices);
export const Lightbulb = wrap(LLightbulb);
export const Triangle = wrap(LTriangle);
export const Palette = wrap(LPalette);
export const BookOpen = wrap(LBookOpen);
export const Hash = wrap(LHash);
export const ExternalLink = wrap(LExternalLink);
export const Download = wrap(LDownload);
export const Moon = wrap(LMoon);
export const Sun = wrap(LSun);
export const Plus = wrap(LPlus);
export const Minus = wrap(LMinus);
export const Pencil = wrap(LPencil);
export const HelpCircle = wrap(LHelpCircle);

export function Star({ size = 14, className, style, filled = false }: IconProps & { filled?: boolean }) {
  return <LStar size={size} className={className} style={style} fill={filled ? "currentColor" : "none"} />;
}

/** Approximately-equal squiggle for the "partial" verdict — no equivalent in lucide. */
export function Tilde({ size = 14, className, style }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
    >
      <path d="M3 13c2.5-4 4.8-4 7 0s4.5 4 7 0" />
    </svg>
  );
}

export function VerdictIcon({ verdict, size = 14, className, style }: IconProps & { verdict: "correct" | "partial" | "incorrect" }) {
  if (verdict === "correct") return <Check size={size} className={className} style={style} />;
  if (verdict === "incorrect") return <X size={size} className={className} style={style} />;
  return <Tilde size={size} className={className} style={style} />;
}

// Shared icon set — stroke-based, 24x24 viewBox, matching ThemeToggle's
// existing sun/moon icons. Keep every icon in this single file so the
// stroke weight/cap style stays consistent app-wide.
type IconProps = { size?: number; className?: string; style?: React.CSSProperties };

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export function ArrowRight({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ArrowLeft({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  );
}

export function ArrowUp({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

export function ArrowDown({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M12 5v14M18 13l-6 6-6-6" />
    </svg>
  );
}

export function ArrowLeftRight({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M16 3l4 4-4 4M20 7H4M8 21l-4-4 4 4-4-4M4 17h16" />
    </svg>
  );
}

export function ChevronUp({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}

export function ChevronDown({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function Check({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function X({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function Star({ size = 14, className, style, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(size)} fill={filled ? "currentColor" : "none"} className={className} style={style}>
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  );
}

export function Sparkles({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M11 2l1.2 4 4 1.2-4 1.2L11 12l-1.2-3.6-4-1.2 4-1.2z" />
      <path d="M18.5 14l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z" />
    </svg>
  );
}

export function Mic({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M12 1.5a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0v-7a3 3 0 0 0-3-3z" />
      <path d="M19 10.5v1.5a7 7 0 0 1-14 0v-1.5" />
      <path d="M12 19v3M8.5 22h7" />
    </svg>
  );
}

export function Search({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function RefreshCw({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M21 12a9 9 0 0 1-15.5 6.4M3 12a9 9 0 0 1 15.5-6.4" />
      <path d="M21 3v6h-6M3 21v-6h6" />
    </svg>
  );
}

export function Scale({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M12 3v18M5 7h14M3 7l3 7a3 3 0 0 0 6 0L9 7M15 7l3 7a3 3 0 0 0 6 0l-3-7" />
    </svg>
  );
}

export function Copy({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function Dice({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="0.6" fill="currentColor" />
      <circle cx="16" cy="8" r="0.6" fill="currentColor" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
      <circle cx="8" cy="16" r="0.6" fill="currentColor" />
      <circle cx="16" cy="16" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function Lightbulb({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M9 18h6M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7c.5.4.8 1 .9 1.6l.1.7h6l.1-.7c.1-.6.4-1.2.9-1.6A7 7 0 0 0 12 2z" />
    </svg>
  );
}

export function Triangle({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M4 20 20 20 4 4z" />
    </svg>
  );
}

export function Palette({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M12 2a10 10 0 1 0 0 20c1.4 0 2-1 2-2 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.4-1.2.1-.7.7-1.1 1.4-1.1H17a3 3 0 0 0 3-3 8 8 0 0 0-8-8z" />
      <circle cx="7.5" cy="10.5" r="0.6" fill="currentColor" />
      <circle cx="10.5" cy="7" r="0.6" fill="currentColor" />
      <circle cx="15" cy="8" r="0.6" fill="currentColor" />
      <circle cx="16.5" cy="12.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function BookOpen({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M2 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H2z" />
      <path d="M22 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z" />
    </svg>
  );
}

export function Hash({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
    </svg>
  );
}

export function ExternalLink({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6M10 14 21 3" />
    </svg>
  );
}

export function Tilde({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M3 13c2.5-4 4.8-4 7 0s4.5 4 7 0" />
    </svg>
  );
}

export function VerdictIcon({ verdict, size = 14, className, style }: IconProps & { verdict: "correct" | "partial" | "incorrect" }) {
  if (verdict === "correct") return <Check size={size} className={className} style={style} />;
  if (verdict === "incorrect") return <X size={size} className={className} style={style} />;
  return <Tilde size={size} className={className} style={style} />;
}

export function Download({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 19h14" />
    </svg>
  );
}

export function Moon({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function Sun({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

export function Plus({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function Minus({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function Pencil({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

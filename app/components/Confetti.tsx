"use client";

import { useEffect, useRef, useState } from "react";

type Particle = {
  id: number;
  x: number;       // 0-100 vw
  color: string;
  size: number;    // px
  delay: number;   // ms
  duration: number; // ms
  rotation: number; // deg
  swing: number;   // horizontal swing px
  shape: "rect" | "circle" | "thin";
};

const COLORS = [
  "#4ade80", "#60a5fa", "#f59e0b", "#f472b6",
  "#a78bfa", "#34d399", "#fb923c", "#e879f9",
];

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function makeParticles(count: number): Particle[] {
  const shapes: Particle["shape"][] = ["rect", "rect", "circle", "thin"];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: rand(0, 100),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: rand(6, 14),
    delay: rand(0, 1200),
    duration: rand(2800, 4800),
    rotation: rand(0, 360),
    swing: rand(-80, 80),
    shape: shapes[Math.floor(Math.random() * shapes.length)],
  }));
}

export default function Confetti({ count = 80 }: { count?: number }) {
  const [particles] = useState(() => makeParticles(count));
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setGone(true), 6000);
    return () => clearTimeout(t);
  }, []);

  if (gone) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        overflow: "hidden", zIndex: 9999,
      }}
    >
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg) translateX(0); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg) translateX(var(--swing)); opacity: 0; }
        }
      `}</style>
      {particles.map((p) => {
        const w = p.shape === "thin"   ? p.size * 0.3 : p.size;
        const h = p.shape === "circle" ? p.size        : p.size * 0.55;
        const br = p.shape === "circle" ? "50%" : p.shape === "thin" ? "2px" : "2px";
        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: "-20px",
              width: w,
              height: h,
              background: p.color,
              borderRadius: br,
              opacity: 1,
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore CSS custom property
              "--swing": `${p.swing}px`,
              animation: `confettiFall ${p.duration}ms ${p.delay}ms ease-in forwards`,
              transform: `rotate(${p.rotation}deg)`,
              willChange: "transform, opacity",
            }}
          />
        );
      })}
    </div>
  );
}

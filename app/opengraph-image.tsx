import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          background: "#FAF9F5",
        }}
      >
        <svg width="96" height="96" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="7" fill="#D97757" />
          <g stroke="#FAF9F5" strokeWidth="1.6" strokeLinecap="round">
            <line x1="11" y1="21" x2="16" y2="10" />
            <line x1="21" y1="21" x2="16" y2="10" />
            <line x1="11" y1="21" x2="21" y2="21" />
          </g>
          <circle cx="16" cy="10" r="3" fill="#FAF9F5" />
          <circle cx="11" cy="21" r="3" fill="#FAF9F5" />
          <circle cx="21" cy="21" r="3" fill="#FAF9F5" />
        </svg>
        <div style={{ fontSize: 72, fontWeight: 700, color: "#262420", letterSpacing: "-0.02em" }}>
          Proofer
        </div>
        <div style={{ fontSize: 28, color: "#87867E" }}>
          An AI tutor that models your understanding of mathematics
        </div>
      </div>
    ),
    { ...size }
  );
}

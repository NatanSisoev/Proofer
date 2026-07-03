import { ImageResponse } from "next/og";

// Shared by icon-192.png/route.tsx and icon-512.png/route.tsx — re-implements
// app/icon.svg's triangle-graph mark as JSX so real PWA-grade PNGs can be
// generated at multiple sizes without checking in binary assets (Cycle 2 #7).
export function pwaIconResponse(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#D97757",
        }}
      >
        <svg width="70%" height="70%" viewBox="0 0 32 32">
          <g stroke="#FAF9F5" strokeWidth="1.6" strokeLinecap="round" fill="none">
            <line x1="11" y1="21" x2="16" y2="10" />
            <line x1="21" y1="21" x2="16" y2="10" />
            <line x1="11" y1="21" x2="21" y2="21" />
          </g>
          <circle cx="16" cy="10" r="3" fill="#FAF9F5" />
          <circle cx="11" cy="21" r="3" fill="#FAF9F5" />
          <circle cx="21" cy="21" r="3" fill="#FAF9F5" />
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}

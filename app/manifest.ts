import type { MetadataRoute } from "next";

// Cycle 2 #7 (PWA pass) — no offline ambition (the LLM needs network anyway),
// just "Add to Home Screen" working sanely: a standalone window, the right
// icons, and a theme color matching the brand.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Proofer",
    short_name: "Proofer",
    description: "AI tutor that models your understanding of mathematics.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF9F5",
    theme_color: "#D97757",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

import { pwaIconResponse } from "./pwa-icon";

// Next.js special-file convention — auto-generates <link rel="apple-touch-icon">.
// iOS prefers a dedicated apple-touch-icon over the manifest for the home
// screen (Cycle 2 #7 — PWA pass).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return pwaIconResponse(size.width);
}

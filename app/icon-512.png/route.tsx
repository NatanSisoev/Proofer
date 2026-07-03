import { pwaIconResponse } from "../pwa-icon";

export const dynamic = "force-static";

export async function GET() {
  return pwaIconResponse(512);
}

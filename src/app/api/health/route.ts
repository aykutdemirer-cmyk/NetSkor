import { NextResponse } from "next/server";
import { checkHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

// Uygulama ayaktaysa her zaman 200; dış servis durumu gövdede (degraded = mock fallback aktif)
export async function GET() {
  return NextResponse.json(await checkHealth(), { headers: { "Cache-Control": "no-store" } });
}

import { NextResponse } from "next/server";
import { checkHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

// Uygulama ayaktaysa her zaman 200; dış servis durumu gövdede (degraded = mock fallback aktif)
export async function GET(req: Request) {
  const deep = new URL(req.url).searchParams.get("deep") === "1";
  return NextResponse.json(await checkHealth(undefined, undefined, deep), { headers: { "Cache-Control": "no-store" } });
}

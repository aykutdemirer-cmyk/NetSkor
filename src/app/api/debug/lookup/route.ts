import { NextResponse } from "next/server";
import { webLookupProduct, type TraceStep } from "@/lib/api/webLookup";
import { configuredProviders } from "@/lib/api/searchProviders";

export const dynamic = "force-dynamic";

// Tanılama: GET /api/debug/lookup?barcode=...&token=...  (DEBUG_TOKEN ortam değişkeni tanımlı olmalı)
// Arama kotası harcar; yalnızca sağlayıcı sonuçlarının başlıklarını döner, anahtar sızdırmaz.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const expected = process.env.DEBUG_TOKEN;
  if (!expected || url.searchParams.get("token") !== expected) return NextResponse.json({ error: "yetkisiz" }, { status: 401 });

  const barcode = (url.searchParams.get("barcode") ?? "").trim();
  const trace: TraceStep[] = [];
  const result = await webLookupProduct(barcode, "baby", fetch, process.env, trace);
  return NextResponse.json({
    barcode,
    providers: configuredProviders(),
    trace,
    found: result ? { name: result.name, brand: result.brand, hasImage: !!result.imageUrl, hasIngredients: !!result.ingredientsText, prices: result.prices } : null,
  });
}

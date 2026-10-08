import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { identifyImage } from "@/lib/identify";
import { allow } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MAX_B64 = 3_500_000; // ~2,6 MB görsel; Vercel gövde sınırının (4,5 MB) altında
const err = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return err("not_configured", 501);

  // Aynı site dışından gelen istekleri reddet (maliyet suistimalini azaltır)
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return err("forbidden", 403);

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const daily = Number(process.env.IDENTIFY_DAILY_LIMIT ?? 300);
  if (!(await allow(`rl:identify:ip:${ip}`, 15, 3600)) || !(await allow(`rl:identify:day:${new Date().toISOString().slice(0, 10)}`, daily, 86400))) {
    return err("rate_limited", 429);
  }

  let body: { image?: unknown; mediaType?: unknown };
  try { body = await req.json(); } catch { return err("bad_request", 400); }

  const mediaType = TYPES.find((t) => t === body.mediaType);
  // "data:image/jpeg;base64,...." biçimi de kabul edilir
  const data = typeof body.image === "string" ? body.image.replace(/^data:[^,]+,/, "") : "";
  if (!mediaType || !data || data.length > MAX_B64 || !/^[A-Za-z0-9+/=]+$/.test(data)) return err("bad_request", 400);

  try {
    const result = await identifyImage(data, mediaType);
    return NextResponse.json({ result }); // result null = tanınamadı
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return err("busy", 429);
    console.error("[identify] başarısız:", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    return err("upstream_error", 502);
  }
}

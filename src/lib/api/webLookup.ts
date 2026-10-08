import type { Category } from "@/types";
import type { LookupResult } from "./productLookup";

type Fetcher = typeof fetch;
type Env = Record<string, string | undefined>;

interface SerpItem { title?: string; snippet?: string; thumbnail?: string; extracted_price?: number }

async function serp(params: Record<string, string>, key: string, f: Fetcher): Promise<{ shopping_results?: SerpItem[]; organic_results?: SerpItem[] }> {
  const qs = new URLSearchParams({ hl: "tr", gl: "tr", num: "8", ...params, api_key: key });
  const res = await f(`https://serpapi.com/search.json?${qs}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`serpapi ${res.status}`);
  return res.json();
}

// \b Türkçe harflerde (ı, ş...) çalışmaz; boşluk sınırlarıyla eşleşir
const NOISE = /(?:^|\s)(?:fiyatları|fiyatı|fiyat|satın al|sipariş|online|kargo bedava|ucuz|özellikleri|yorumları|incele)(?=\s|$)/gi;

/** "Nutella 400 g - Fiyatı | Migros" -> "Nutella 400 g" */
export function cleanTitle(t: string): string {
  const first = t.split(/\s[-–—|•:]\s/)[0];
  return first.replace(NOISE, "").replace(/\s{2,}/g, " ").trim().slice(0, 90);
}

const tokens = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9çğıöşü]+/i).filter((w) => w.length > 1));

/** Başlıklar arasında en çok ortak kelimeye sahip olanı seçer (tek bir mağazanın tuhaf başlığını eler). */
export function consensusTitle(titles: string[]): string {
  const list = titles.filter(Boolean);
  if (list.length <= 2) return list[0] ?? "";
  const sets = list.map(tokens);
  let best = 0, bestScore = -1;
  sets.forEach((a, i) => {
    const score = sets.reduce((s, b, j) => {
      if (i === j) return s;
      const inter = [...a].filter((w) => b.has(w)).length;
      return s + inter / (a.size + b.size - inter || 1);
    }, 0);
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return list[best];
}

/** Arama özetindeki "İçindekiler: ..." kısmını çıkarır. */
export function extractIngredients(text: string): string | undefined {
  const m = text.match(/(?:[İIiı]çindekiler|[İIiı]çerik|ingredients)\s*[:：]\s*(.{20,400}?)(?:\.\s|\.$|$)/i);
  return m?.[1].trim();
}

const quantityOf = (name: string) => name.match(/(\d+(?:[.,]\d+)?)\s?(kg|gr?|ml|lt|l)\b/i)?.[0];

/** Open Facts'te bulunamayan barkodu internet aramasıyla (SerpAPI) çözer. Anahtar yoksa/hata olursa null. */
export async function webLookupProduct(barcode: string, _category: Category, f: Fetcher = fetch, env: Env = process.env): Promise<(LookupResult & { prices: number[] }) | null> {
  const key = env.SERPAPI_KEY;
  if (!key || !/^\d{8,14}$/.test(barcode)) return null;
  try {
    const shop = await serp({ engine: "google_shopping", q: barcode }, key, f);
    let items = (shop.shopping_results ?? []).filter((r) => r.title);
    if (items.length === 0) items = ((await serp({ engine: "google", q: `"${barcode}"` }, key, f)).organic_results ?? []).filter((r) => r.title);

    const name = consensusTitle(items.map((r) => cleanTitle(r.title!)));
    if (!name || name.length < 3) return null;

    // İçerik listesi: ayrı bir arama (en iyi çaba)
    let ingredientsText: string | undefined;
    try {
      const ing = await serp({ engine: "google", q: `${name} içindekiler` }, key, f);
      ingredientsText = (ing.organic_results ?? []).map((r) => extractIngredients(r.snippet ?? "")).find(Boolean);
    } catch { /* içerik yoksa "veri yok" gösterilir */ }

    return {
      barcode,
      name,
      brand: name.split(" ")[0], // başlıktan tahmin; doğrulanmadı
      imageUrl: items.find((r) => r.thumbnail)?.thumbnail,
      ingredientsText,
      analysisTags: [],
      quantity: quantityOf(name),
      source: "web",
      prices: items.map((r) => r.extracted_price).filter((n): n is number => typeof n === "number"),
    };
  } catch (e) {
    console.error("[webLookup] başarısız:", e instanceof Error ? e.message : e);
    return null;
  }
}

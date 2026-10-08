import type { Category } from "@/types";
import { searchWeb } from "./searchProviders";
import { extractPrices } from "@/lib/scoring/priceEstimator";
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

/** Open Facts'te bulunamayan barkodu internet aramasıyla çözer. Önce SerpAPI Shopping (görsel+fiyat), olmazsa genel arama zinciri. */
export async function webLookupProduct(barcode: string, _category: Category, f: Fetcher = fetch, env: Env = process.env): Promise<(LookupResult & { prices: number[] }) | null> {
  if (!/^\d{8,14}$/.test(barcode)) return null;

  let titles: string[] = [];
  let image: string | undefined;
  let prices: number[] = [];

  const key = env.SERPAPI_KEY;
  if (key) {
    try {
      const items = ((await serp({ engine: "google_shopping", q: barcode }, key, f)).shopping_results ?? []).filter((r) => r.title);
      titles = items.map((r) => cleanTitle(r.title!));
      image = items.find((r) => r.thumbnail)?.thumbnail;
      prices = items.map((r) => r.extracted_price).filter((n): n is number => typeof n === "number");
    } catch (e) {
      console.error("[webLookup] shopping başarısız:", e instanceof Error ? e.message : e);
    }
  }

  if (titles.length === 0) {
    const r = await searchWeb(`"${barcode}" ürün`, env, f); // yedek zincir: Serper / Brave / Google CSE
    if (!r) return null;
    const hits = r.hits.filter((h) => h.title);
    titles = hits.map((h) => cleanTitle(h.title));
    prices = hits.flatMap((h) => extractPrices(`${h.title} ${h.snippet}`));
  }

  const name = consensusTitle(titles);
  if (!name || name.length < 3) return null;

  // İçerik listesi: ayrı bir arama (en iyi çaba)
  const ing = await searchWeb(`${name} içindekiler`, env, f);
  const ingredientsText = ing?.hits.map((h) => extractIngredients(h.snippet)).find(Boolean);

  return {
    barcode,
    name,
    brand: name.split(" ")[0], // başlıktan tahmin; doğrulanmadı
    imageUrl: image,
    ingredientsText,
    analysisTags: [],
    quantity: quantityOf(name),
    source: "web",
    prices,
  };
}

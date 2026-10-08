import type { Category } from "@/types";
import { searchWeb } from "./searchProviders";
import { selectPrices } from "@/lib/scoring/priceEstimator";
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
  // Başlıkta geçen barkod numarası ürün adına karışmasın
  return first.replace(/\b\d{8,14}\b/g, "").replace(NOISE, "").replace(/\s{2,}/g, " ").trim().slice(0, 90);
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

// "3-6 kg" bebek ağırlık aralığıdır, paket gramajı değil: aralık içindeki değer atlanır
const quantityOf = (name: string) => name.match(/(?<!\d\s?[-–]\s?)(\d+(?:[.,]\d+)?)\s?(kg|gr?|ml|lt|l)(?![\wçğıöşüÇĞİÖŞÜ])/i)?.[0];

export interface TraceStep { query: string; via: string; count: number; titles: string[] }

interface Candidate { title: string; link: string; trusted: boolean; prices: number[]; image?: string; snippet?: string }

// Türkçe ürün kelimeleri (harf kuralı güvenilmez: Kazakça da "Ç" kullanıyor)
const TR_WORDS = /(?:^|\s)(?:bebek|bezi|adet|paket|numara|krem\w*|şampuan\w*|sabun\w*|temizl\w*|deterjan\w*|çikolata\w*|bisküvi\w*|ürün\w*|fiyat\w*|bantlı|kutu)(?=\s|$)/i;

const hostOf = (link: string) => { try { return new URL(link).hostname; } catch { return ""; } };

const jaccard = (a: string, b: string) => {
  const x = tokens(a), y = tokens(b);
  const inter = [...x].filter((w) => y.has(w)).length;
  return inter / (x.size + y.size - inter || 1);
};

/** Barkodu içermeyen sonuçlar yalnızca en az 3 başlık birbirine benziyorsa kabul edilir (yanlış ürün riskini azaltır). */
function agree(titles: string[]): boolean {
  if (titles.length < 3) return false;
  const top = titles.slice(0, 4);
  let sum = 0, n = 0;
  for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) { sum += jaccard(top[i], top[j]); n++; }
  return sum / n >= 0.3;
}

/**
 * Open Facts'te bulunamayan barkodu internet aramasıyla çözer.
 * Ürün adı yalnızca sonuç metninde barkodun geçtiği kaynaklardan (ya da birbirini doğrulayan başlıklardan) belirlenir.
 * Google Shopping barkodla birebir eşleşmediği için yalnızca ad bulunduktan sonra, ada benzerlik filtresiyle görsel/fiyat için kullanılır.
 */
export async function webLookupProduct(barcode: string, _category: Category, f: Fetcher = fetch, env: Env = process.env, trace?: TraceStep[]): Promise<(LookupResult & { prices: number[] }) | null> {
  if (!/^\d{8,14}$/.test(barcode)) return null;

  const pool: Candidate[] = [];
  const seen = new Set<string>();
  const add = (c: Candidate) => { const k = `${c.title}|${c.link}`; if (!seen.has(k)) { seen.add(k); pool.push(c); } };
  const note = (query: string, via: string, titles: string[]) => trace?.push({ query, via, count: titles.length, titles: titles.slice(0, 5) });

  // Genel arama: iki sorgu biçimi; sonuçta barkod geçiyorsa "doğrulanmış" sayılır
  for (const q of [barcode, `"${barcode}" barkod`]) {
    const r = await searchWeb(q, env, f); // yedek zincir: SerpAPI / Serper / Brave / Google CSE
    if (!r) { note(q, "yok", []); break; }
    const hits = r.hits.filter((h) => h.title);
    note(q, r.provider, hits.map((h) => h.title));
    hits.forEach((h) => add({
      title: cleanTitle(h.title), link: h.link, image: h.image, snippet: h.snippet,
      trusted: `${h.title} ${h.snippet} ${h.link}`.includes(barcode),
      prices: [],
    }));
    if (pool.filter((c) => c.trusted).length >= 2) break;
  }

  const trusted = pool.filter((c) => c.trusted);
  let chosen = trusted.length > 0 ? trusted : agree(pool.map((c) => c.title)) ? pool : [];
  // Türkçe kaynakları (.tr alan adı ya da Türkçe harfli başlık) tercih et: yabancı mağaza başlıkları ürün adını bozuyor
  const turkish = chosen.filter((c) => /\.tr$/.test(hostOf(c.link)) || TR_WORDS.test(c.title));
  if (turkish.length > 0) chosen = turkish;
  const name = consensusTitle(chosen.map((c) => c.title));
  if (!name || name.length < 3) {
    console.error(`[webLookup] ürün çıkarılamadı barkod=${barcode} aday=${pool.length} güvenilir=${trusted.length}`);
    return null;
  }

  let image = chosen.find((c) => c.image)?.image;
  let prices = selectPrices(chosen.map((c) => ({ title: c.title, snippet: c.snippet ?? "" })), name);

  // Eksik görsel/fiyat için ürün adıyla Shopping; ada benzemeyen sonuçlar (başka ürünler) atılır
  const key = env.SERPAPI_KEY;
  if (key && (!image || prices.length === 0)) {
    try {
      const items = ((await serp({ engine: "google_shopping", q: name }, key, f)).shopping_results ?? []).filter((r) => r.title);
      note(name, "serpapi-shopping", items.map((r) => r.title!));
      const similar = items.filter((r) => jaccard(cleanTitle(r.title!), name) >= 0.35);
      image ??= similar.find((r) => r.thumbnail)?.thumbnail;
      if (prices.length === 0) prices = similar.map((r) => r.extracted_price).filter((n): n is number => typeof n === "number");
    } catch (e) {
      console.error("[webLookup] shopping başarısız:", e instanceof Error ? e.message : e);
    }
  }

  // İçerik listesi: ayrı bir arama (en iyi çaba)
  const ing = await searchWeb(`${name} içindekiler`, env, f);
  const ingredientsText = ing?.hits.map((h) => extractIngredients(h.snippet)).find(Boolean);
  note(`${name} içindekiler`, ing?.provider ?? "yok", (ing?.hits ?? []).map((h) => h.title));

  return {
    barcode,
    name,
    brand: name.split(" ")[0], // başlıktan tahmin; doğrulanmadı
    imageUrl: image,
    ingredientsText,
    analysisTags: [],
    quantity: quantityOf(name),
    source: "web",
    description: chosen.map((c) => `${c.title}. ${c.snippet ?? ""}`).join(" ").slice(0, 1500),
    prices,
  };
}

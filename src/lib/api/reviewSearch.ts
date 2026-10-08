import { searchWeb, type WebHit } from "./searchProviders";
import { extractPrices } from "@/lib/scoring/priceEstimator";
import { inferRating } from "@/lib/scoring/reviewAnalyzer";
import type { Category, Review, ReviewSource } from "@/types";

export interface SearchInput { productName: string; brand: string; category: Category }
export interface SearchOutput { mode: "live" | "demo"; reviews: Review[]; prices: number[] }
type Fetcher = typeof fetch;
type Env = Record<string, string | undefined>;

const PLATFORMS: { source: ReviewSource; host: string; template: (q: string) => string }[] = [
  { source: "google", host: "google.", template: (q) => `${q} yorumlar kullanıcı deneyimi` },
  { source: "trendyol", host: "trendyol.com", template: (q) => `site:trendyol.com ${q} yorumlar` },
  { source: "hepsiburada", host: "hepsiburada.com", template: (q) => `site:hepsiburada.com ${q} yorumlar` },
  { source: "amazon_tr", host: "amazon.com.tr", template: (q) => `site:amazon.com.tr ${q} yorumlar` },
];

// Yalnızca şikayet toplayan siteler skoru olumsuza yanlılaştırır; dışarıda bırakılır
const BLOCKED_HOSTS = ["sikayetvar.com"];
const blocked = (link: string) => { try { return BLOCKED_HOSTS.some((h) => new URL(link).hostname.endsWith(h)); } catch { return true; } };

const sourceOf = (link: string): ReviewSource => {
  try {
    const h = new URL(link).hostname;
    return PLATFORMS.find((p) => p.source !== "google" && h.includes(p.host))?.source ?? "google";
  } catch { return "google"; }
};

// --- Deterministik demo üreteci (anahtar yok / ağ hatası) ---
const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const rng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const DEMO: Record<Category, { pos: string[]; neg: string[]; profiles: string[]; price: number }> = {
  baby: {
    pos: ["Bebeğimde tahriş yapmadı, kokusu güzel.", "Hızlı iyileşme sağladı, çok memnun kaldım.", "Fiyat performans ürünü, uzun gidiyor.", "Hassas cilt için uygun, alerji yapmadı."],
    neg: ["Bebeğimde kızarıklık yaptı.", "Kokusu ağır geldi, alerji şüphesi var.", "Pişik yaptı, bir daha almayacağım.", "Bez beden olarak küçük geldi."],
    profiles: ["4 Aylık Bebek Annesi", "9 Aylık Bebek Babası", "Hassas Ciltli Bebek", "1 Yaş Bebek Annesi"], price: 180,
  },
  cosmetics: {
    pos: ["Cildimde etkili oldu, güzel koku.", "Hassas cildime uygun, tahriş yapmadı.", "Uzun gidiyor, fiyat performans.", "Hızlı etki gösterdi, memnun kaldım."],
    neg: ["Sivilce yaptı, yüzümü bozdu.", "Yanma yaptı, kullanamadım.", "Etki etmedi, parama yazık.", "Yağlandırdı ve gözenek tıkadı."],
    profiles: ["Kuru & Hassas Cilt", "Karma Cilt", "Yağlı Cilt", "Olgun Cilt"], price: 320,
  },
  food: {
    pos: ["Çok lezzetli, tadı harika.", "Fiyat performans açısından ekonomik.", "Memnun kaldım, taze geldi."],
    neg: ["Şekeri çok fazla.", "Bayat geldi, tarihi geçmiş gibi.", "Ambalaj patlak geldi.", "Bozuk çıktı."],
    profiles: ["Aile Alışverişi", "Çocuklu Aile", "Diyet Yapan", "Öğrenci"], price: 55,
  },
  cleaning: {
    pos: ["Etkili, leke gitti, memnun kaldım.", "Güzel koku, uzun gidiyor.", "Ekonomik ve ise yaradi."],
    neg: ["Kokusu ağır, baş ağrıttı.", "Temizlemedi, etki etmedi.", "Elim yardı, tahriş yaptı."],
    profiles: ["Evde Bebekli Aile", "Alerjik Kullanıcı", "Standart Kullanıcı"], price: 110,
  },
};

export function demoReviews(input: SearchInput, barcode: string): SearchOutput {
  const r = rng(hash(`${barcode}|${input.brand}|${input.productName}`));
  const d = DEMO[input.category];
  const bias = 0.55 + r() * 0.35; // ürün başına olumlu yorum eğilimi (deterministik)
  const reviews: Review[] = Array.from({ length: 8 }, (_, i) => {
    const positive = r() < bias;
    const pool = positive ? d.pos : d.neg;
    const text = pool[Math.floor(r() * pool.length)];
    const rating = (positive ? 4 + Math.round(r()) : 1 + Math.round(r() * 2)) as 1 | 2 | 3 | 4 | 5;
    return {
      id: `demo-${barcode}-${i}`, source: PLATFORMS[i % 4].source, author: `kullanıcı${Math.floor(r() * 900 + 100)}`,
      verifiedBuyer: false, profile: d.profiles[Math.floor(r() * d.profiles.length)], rating, text, flags: [],
    };
  });
  const prices = Array.from({ length: 4 }, () => Math.round(d.price * (0.7 + r() * 0.7)));
  return { mode: "demo", reviews, prices };
}

export async function searchReviews(input: SearchInput, barcode: string, f: Fetcher = fetch, env: Env = process.env): Promise<SearchOutput> {
  // Ad zaten markayla başlıyorsa markayı tekrarlama ("Molfix Molfix ...")
  const q = (input.productName.toLowerCase().startsWith(input.brand.toLowerCase()) ? input.productName : `${input.brand} ${input.productName}`).trim();
  // 4 platform sorgusu; her biri kendi sağlayıcı zincirini kullanır (kota biterse yedeğe geçer)
  const results = await Promise.all(PLATFORMS.map((p) => searchWeb(p.template(q), env, f)));
  if (results.every((r) => r === null)) return demoReviews(input, barcode); // anahtar yok ya da tüm sağlayıcılar başarısız

  const hits: WebHit[] = results.flatMap((r) => r?.hits ?? []).filter((h) => h.snippet && h.link && !blocked(h.link));
  const reviews: Review[] = hits.map((h, i) => ({
    id: `live-${barcode}-${i}`, source: sourceOf(h.link), author: new URL(h.link).hostname.replace(/^www\./, ""),
    verifiedBuyer: false, rating: (h.rating ? Math.min(5, Math.max(1, Math.round(h.rating))) : inferRating(h.snippet, input.category)) as 1 | 2 | 3 | 4 | 5,
    text: h.snippet, flags: [],
  }));
  if (reviews.length === 0) {
    // Uzun ürün adı sonuç vermemiş olabilir: ilk 4 kelimeyle tek bir genel arama daha dene
    const short = await searchWeb(`${q.split(/\s+/).slice(0, 4).join(" ")} yorumlar`, env, f);
    const extra = (short?.hits ?? []).filter((h) => h.snippet && h.link && !blocked(h.link));
    if (extra.length === 0) return demoReviews(input, barcode);
    return {
      mode: "live",
      reviews: extra.map((h, i) => ({ id: `live-${barcode}-s${i}`, source: sourceOf(h.link), author: new URL(h.link).hostname.replace(/^www\./, ""), verifiedBuyer: false, rating: (h.rating ? Math.min(5, Math.max(1, Math.round(h.rating))) : inferRating(h.snippet, input.category)) as 1 | 2 | 3 | 4 | 5, text: h.snippet, flags: [] })),
      prices: extra.flatMap((h) => extractPrices(`${h.title} ${h.snippet}`)),
    };
  }
  return { mode: "live", reviews, prices: hits.flatMap((h) => extractPrices(`${h.title} ${h.snippet}`)) };
}

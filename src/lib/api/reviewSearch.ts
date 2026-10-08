import { normTr } from "@/lib/text";
import { searchWeb, type WebHit } from "./searchProviders";
import { selectPrices } from "@/lib/scoring/priceEstimator";
import { inferRating, isFirstPersonExperience, isPromotional, stripDelivery } from "@/lib/scoring/reviewAnalyzer";
import type { Category, Review, ReviewSource } from "@/types";

export interface SearchInput { productName: string; brand: string; category: Category }
export interface SearchOutput { mode: "live" | "demo"; reviews: Review[]; prices: number[] }
type Fetcher = typeof fetch;
type Env = Record<string, string | undefined>;

const SOCIAL = ["instagram.com", "facebook.com", "tiktok.com", "youtube.com"];
const brandSlug = (brand: string) => normTr(brand).replace(/[^a-z0-9]/g, "");

// Sorgudan sosyal medya ve markanın kendi resmi alan adları dışlanır (-site:)
const exclusions = (brand: string) => {
  const slug = brandSlug(brand);
  const own = slug.length >= 3 ? [`${slug}.com.tr`, `${slug}.com`] : [];
  return [...SOCIAL, ...own].map((d) => `-site:${d}`).join(" ");
};

const PLATFORMS: { source: ReviewSource; host: string; only?: Category[]; template: (q: string) => string }[] = [
  { source: "google", host: "google.", template: (q) => `${q} yorumlar kullanıcı deneyimi` },
  { source: "trendyol", host: "trendyol.com", template: (q) => `site:trendyol.com ${q} yorumlar` },
  { source: "hepsiburada", host: "hepsiburada.com", template: (q) => `site:hepsiburada.com ${q} yorumlar` },
  { source: "amazon_tr", host: "amazon.com.tr", template: (q) => `site:amazon.com.tr ${q} yorumlar` },
  // Anne/bebek forumları: yalnızca bebek kategorisinde ek tek sorgu
  { source: "forum", host: "kadinlarkulubu.com", only: ["baby"], template: (q) => `${q} (site:kadinlarkulubu.com OR site:eksisozluk.com)` },
];
const FORUM_HOSTS = ["kadinlarkulubu.com", "eksisozluk.com"];
// Bebek kategorisinde öncelik: forum > Trendyol > Hepsiburada > Amazon > genel
const PRIORITY: Record<ReviewSource, number> = { forum: 0, trendyol: 1, hepsiburada: 2, amazon_tr: 3, google: 4 };

// Yalnızca şikayet toplayan siteler skoru olumsuza yanlılaştırır; dışarıda bırakılır
const BLOCKED_HOSTS = ["sikayetvar.com", "x.com", "twitter.com", "pinterest.com", ...SOCIAL];
// Markanın kendi sitesi de yorum kaynağı değildir (tanıtım metni)
const blocked = (link: string, brand = "") => {
  try {
    const host = new URL(link).hostname;
    const b = normTr(brand).replace(/[^a-z0-9]/g, "");
    return BLOCKED_HOSTS.some((h) => host.endsWith(h)) || (b.length >= 3 && normTr(host).replace(/[^a-z0-9]/g, "").includes(b));
  } catch { return true; }
};

// Mağaza sayfası reklam/boş metinleri yorum değildir: yorum skorunu ve rozetleri bozar
const BOILERPLATE = /satın\s+al|yorumlarını\s+incele|inceleyin|indirimli\s+fiyat|sepete\s+ekle|ücretsiz\s+kargo|hemen\s+(incele|sipariş)|bu\s+sayfada\s+bilgi\s+yok|fiyatları\s+ve\s+özellikleri|en\s+uygun\s+fiyat|kampanya/i;
// Menü/liste ("A · B · C") ve hashtag'li tanıtım metinleri yorum değildir
export const isReviewLike = (snippet: string) =>
  snippet.trim().length >= 25 && !BOILERPLATE.test(snippet) && (snippet.match(/·/g) ?? []).length < 2 && !/#\w/.test(snippet);

const sourceOf = (link: string): ReviewSource => {
  try {
    const h = new URL(link).hostname;
    if (FORUM_HOSTS.some((f) => h.endsWith(f))) return "forum";
    return PLATFORMS.find((p) => p.source !== "google" && p.source !== "forum" && h.includes(p.host))?.source ?? "google";
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
  const ex = exclusions(input.brand);
  const platforms = PLATFORMS.filter((p) => !p.only || p.only.includes(input.category));
  // Platform sorguları; her biri kendi sağlayıcı zincirini kullanır (kota biterse yedeğe geçer)
  const results = await Promise.all(platforms.map((p) => searchWeb(`${p.template(q)} ${ex}`, env, f)));
  if (results.every((r) => r === null)) return demoReviews(input, barcode); // anahtar yok ya da tüm sağlayıcılar başarısız

  // Aynı sayfa birden çok sorguda çıkabilir: fiyat medyanını çarpıtmasın diye tekilleştirilir
  const dedupe = (hs: WebHit[]) => [...new Map(hs.map((h) => [`${h.link}|${h.title}`, h])).values()];
  const rawHits = dedupe(results.flatMap((r) => r?.hits ?? []));
  let live = collect(rawHits, input);
  let priceHits = rawHits;
  if (live.hits.length === 0) {
    // Uzun ürün adı sonuç vermemiş olabilir: ilk 4 kelimeyle tek bir genel arama daha dene
    const short = await searchWeb(`${q.split(/\s+/).slice(0, 4).join(" ")} yorumlar ${ex}`, env, f);
    live = collect(short?.hits ?? [], input);
    priceHits = dedupe([...rawHits, ...(short?.hits ?? [])]);
    if (live.hits.length === 0) return demoReviews(input, barcode);
  }

  const reviews: Review[] = live.hits.map((h, i) => ({
    id: `live-${barcode}-${i}`, source: sourceOf(h.link), author: new URL(h.link).hostname.replace(/^www\./, ""),
    verifiedBuyer: false, rating: live.rate(h) as 1 | 2 | 3 | 4 | 5, text: h.snippet, flags: [],
  }));
  if (input.category === "baby") reviews.sort((a, b) => PRIORITY[a.source] - PRIORITY[b.source]); // sort kararlı: eşit kaynakta sıra korunur
  // Fiyat, yorum olmayan ürün sayfası özetlerinden de alınır; tekil ürün fiyatı öncelikli
  const prices = selectPrices(priceHits.filter((h) => h.link && !blocked(h.link, input.brand)), q);
  return { mode: "live", reviews, prices };
}

/** Sonuçları yorum olarak kullanılabilir olanlara indirger (tekrar, çöp metin, teslimat, duygusuz özet elenir). */
function collect(raw: WebHit[], input: SearchInput) {
  const seen = new Set<string>();
  const rate = (h: WebHit) => (h.rating ? Math.min(5, Math.max(1, Math.round(h.rating))) : inferRating(h.snippet, input.category));
  const hits = raw.filter((h) => {
    if (!h.snippet || !h.link || blocked(h.link, input.brand) || !isReviewLike(h.snippet)) return false;
    if (isPromotional(h.snippet)) return false; // katalog/pazarlama metni, kullanıcı yorumu değil
    if (!h.rating && !isFirstPersonExperience(h.snippet)) return false; // deneyim bildirmeyen cümleler yorum sayılmaz
    const k = `${h.link}|${h.snippet}`;
    if (seen.has(k)) return false; // aynı sayfa birden çok sorguda çıkabilir
    seen.add(k);
    if (h.rating) return true; // gerçek puan varsa kullan
    if (stripDelivery(h.snippet).trim().length < 20) return false; // yalnızca kargo/satıcı yorumu
    return rate(h) !== 3; // duygu ipucu olmayan özet skora katılmaz
  });
  return { hits, rate };
}

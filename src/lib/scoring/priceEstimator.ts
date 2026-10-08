import { normTr } from "@/lib/text";
import type { Category } from "@/types";

// Kategori referansı: 100 g/ml başına ortalama TL ve ortalama paket fiyatı (TL)
const REF: Record<Category, { per100: number; pack: number }> = {
  baby: { per100: 60, pack: 300 },
  cosmetics: { per100: 120, pack: 450 },
  food: { per100: 35, pack: 100 },
  cleaning: { per100: 25, pack: 150 },
};

export interface PriceEstimate { priceScore: number; medianPrice: number; basis: "unit" | "pack" }

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** "500 ml", "2 x 125 g", "1,5 L" -> gram/ml cinsinden miktar ve birim */
export function parseQuantityFull(q?: string): { amount: number; unit: "g" | "ml" } | null {
  if (!q) return null;
  const m = q.toLowerCase().replace(",", ".").match(/(?:(\d+)\s*x\s*)?(\d+(?:\.\d+)?)\s*(kg|g|gr|l|lt|ml|cl)(?![a-zçğıöşü])/);
  if (!m) return null;
  const mult = { kg: 1000, g: 1, gr: 1, l: 1000, lt: 1000, ml: 1, cl: 10 }[m[3]]!;
  return { amount: (m[1] ? Number(m[1]) : 1) * Number(m[2]) * mult, unit: ["l", "lt", "ml", "cl"].includes(m[3]) ? "ml" : "g" };
}
export const parseQuantity = (q?: string): number | null => parseQuantityFull(q)?.amount ?? null;

/** "36Lı", "36'lı", "36 lı", "36 adet" -> adet sayısı (en az 4; "2'li paket" gibi çoklu paketler yok sayılır) */
export function parseCount(text?: string): number | null {
  if (!text) return null;
  const m = normTr(text).match(/(\d{1,4})\s*['’`´]?\s*(?:li|lu|adet|ad)(?![a-z0-9])/);
  const n = m ? Number(m[1]) : 0;
  return n >= 4 ? n : null;
}

// Adet başına referans fiyatlar (TL) — kaba tahmin, piyasaya göre güncellenmeli
// min/max: adet başına makul sınırlar; üstü koli/çoklu paket ya da hatalı snippet, altı eksik/hatalı sayı sayılır
const UNIT_REF: { kind: "bez" | "mendil"; test: RegExp; ref: number; min: number; max: number }[] = [
  { kind: "bez", test: /\b(bez|bezi|diaper|nappy)\b/, ref: 5, min: 1.5, max: 15 },
  { kind: "mendil", test: /\b(mendil|wipes?)\b/, ref: 0.7, min: 0.1, max: 3 },
];
export const unitKind = (name: string) => UNIT_REF.find((u) => u.test.test(normTr(name)));
export const fmtTl = (n: number) => n.toFixed(2).replace(".", ",").replace(/,00$/, "");

export interface UnitPriceEstimate extends PriceEstimate { unitText: string }

const scoreOf = (ratio: number) => Math.round(Math.min(100, Math.max(0, 100 - 40 * (ratio - 0.5))));

/** Adet başına fiyat: bez/mendil için referansa göre skor ve "4,2 TL / bez" metni. */
export function estimateUnitPrice(prices: number[], count: number, kind: "bez" | "mendil"): UnitPriceEstimate | null {
  const { ref, min, max } = UNIT_REF.find((u) => u.kind === kind)!;
  const expected = ref * count;
  // Adet başına fiyatı sınır dışı olanlar (ör. 36'lı paket için 1500 TL = 41 TL/bez) medyandan dışlanır
  const usable = prices.filter((p) => p >= expected * 0.2 && p <= expected * 5 && p / count >= min && p / count <= max);
  if (usable.length === 0) return null;
  const med = median(usable), unit = med / count;
  return { priceScore: scoreOf(unit / ref), medianPrice: Math.round(med * 100) / 100, basis: "unit", unitText: `${fmtTl(unit)} TL / ${kind}` };
}

/** Gramaj/hacim biliniyorsa 100 g/ml başına fiyat metni. */
export function perHundredText(price: number, q?: string): string | undefined {
  const full = parseQuantityFull(q);
  return full ? `${fmtTl((price / full.amount) * 100)} TL / 100 ${full.unit}` : undefined;
}

/** Fiyat snippet'larından ("249,90 TL", "₺151,50") sayıları çıkarır. */
export function extractPrices(text: string): number[] {
  const out: number[] = [];
  const num = "(\\d{1,3}(?:\\.\\d{3})*(?:,\\d{1,2})?|\\d+(?:,\\d{1,2})?)";
  // Para birimi sayıdan sonra ("151,50 TL") ya da önce ("₺151,50", "TL 151,50")
  for (const m of text.matchAll(new RegExp(`${num}\\s*(?:TL|₺)|(?:₺|TL)\\s*${num}`, "gi"))) {
    const v = Number((m[1] ?? m[2]).replace(/\./g, "").replace(",", "."));
    if (v >= 5 && v < 100000) out.push(v);
  }
  return out;
}

export interface PriceMention { value: number; labeled: boolean; cheapest: boolean }

/** Fiyatları bağlamıyla çıkarır: "Fiyat : ₺151,50" etiketli, "en ucuz ..." / "başlayan" ifadeleri tek ürün fiyatı değildir. */
export function extractPriceMentions(text: string): PriceMention[] {
  const out: PriceMention[] = [];
  const num = "(\\d{1,3}(?:\\.\\d{3})*(?:,\\d{1,2})?|\\d+(?:,\\d{1,2})?)";
  for (const m of text.matchAll(new RegExp(`${num}\\s*(?:TL|₺)|(?:₺|TL)\\s*${num}`, "gi"))) {
    const v = Number((m[1] ?? m[2]).replace(/\./g, "").replace(",", "."));
    if (!(v >= 5 && v < 100000)) continue;
    const before = text.slice(Math.max(0, (m.index ?? 0) - 30), m.index ?? 0);
    out.push({ value: v, labeled: /fiyat|sepet|tutar|ücret/i.test(before), cheapest: /en\s+ucuz|başlayan|başlangıç|itibaren/i.test(before) });
  }
  return out;
}

const words = (s: string) => new Set(normTr(s).split(/[^a-z0-9]+/).filter((w) => w.length > 1));
const sim = (a: string, b: string) => {
  const x = words(a), y = words(b);
  const inter = [...x].filter((w) => y.has(w)).length;
  return inter / (x.size + y.size - inter || 1);
};
// Koli / çoklu paket / toptan satış metinleri tek ürün fiyatı değildir
const BULK = /koli|çoklu\s+paket|\b\d+\s*x\s*\d+|\b\d+\s*paket\b|\btoptan\s+fiyat/i;

/**
 * Arama sonuçlarından tekil ürün fiyatını seçer. Öncelik: ürün başlığıyla eşleşen + "Fiyat:" etiketli + koli olmayan,
 * sonra yalnızca eşleşen, sonra eşleşme aramayan; hiçbiri yoksa tümü. "En ucuz / başlayan" fiyatlar son sıraya düşer.
 */
export function selectPrices(hits: { title: string; snippet: string }[], productName: string): number[] {
  const pool = hits.flatMap((h) => {
    const text = `${h.title}. ${h.snippet}`;
    const similar = sim(h.title, productName) >= 0.3;
    const bulk = BULK.test(text);
    return extractPriceMentions(text).map((m) => ({ ...m, similar, bulk }));
  });
  const tiers = [
    pool.filter((m) => m.similar && m.labeled && !m.bulk && !m.cheapest),
    pool.filter((m) => m.similar && !m.bulk && !m.cheapest),
    pool.filter((m) => !m.bulk && !m.cheapest),
    pool,
  ];
  return (tiers.find((t) => t.length > 0) ?? []).map((m) => m.value);
}

/** 100 = referansın yarısı veya daha ucuz, 80 = referans fiyat, 40 = referansın 2 katı (referanslar kaba tahmindir). */
export function estimatePrice(category: Category, prices: number[], amount: number | null): PriceEstimate | null {
  const ref = REF[category];
  const expected = amount ? (ref.per100 * amount) / 100 : ref.pack;
  // Beklenen fiyatın 0.2x-5x dışındakiler büyük olasılıkla başka bir sayıdır (tazminat, taksit, başka boy); elenir
  const usable = prices.filter((p) => p >= expected * 0.2 && p <= expected * 5);
  if (usable.length === 0) return null; // güvenilir fiyat yok: "Veri yok" gösterilir, 0 puan verilmez
  const med = median(usable);
  const ratio = med / expected;
  const priceScore = scoreOf(ratio);
  return { priceScore, medianPrice: Math.round(med * 100) / 100, basis: amount ? "unit" : "pack" };
}

/** Kategori ortalaması (TL / g veya ml); bez/mendil için adet başına referans. */
export const categoryAvgPerUnit = (category: Category) => REF[category].per100 / 100;
export const unitRefPerPiece = (kind: "bez" | "mendil") => UNIT_REF.find((u) => u.kind === kind)!.ref;

/** Kategori ortalamasına göre fark: "%63 daha ucuz" / "%12 daha pahalı" (|fark| < %3 ise ortalamaya yakın). */
export function vsAverage(value: number, avg: number): { pct: number; text: string; cheaper: boolean } {
  const pct = Math.round((1 - value / avg) * 100);
  const abs = Math.abs(pct);
  return { pct, cheaper: pct >= 0, text: abs < 3 ? "kategori ortalamasına yakın" : `kategori ortalamasına göre %${abs} ${pct > 0 ? "daha ucuz" : "daha pahalı"}` };
}

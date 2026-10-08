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
const UNIT_REF: { kind: "bez" | "mendil"; test: RegExp; ref: number }[] = [
  { kind: "bez", test: /\b(bez|bezi|diaper|nappy)\b/, ref: 5 },
  { kind: "mendil", test: /\b(mendil|wipes?)\b/, ref: 0.7 },
];
export const unitKind = (name: string) => UNIT_REF.find((u) => u.test.test(normTr(name)));
export const fmtTl = (n: number) => n.toFixed(2).replace(".", ",").replace(/,00$/, "");

export interface UnitPriceEstimate extends PriceEstimate { unitText: string }

const scoreOf = (ratio: number) => Math.round(Math.min(100, Math.max(0, 100 - 40 * (ratio - 0.5))));

/** Adet başına fiyat: bez/mendil için referansa göre skor ve "4,2 TL / bez" metni. */
export function estimateUnitPrice(prices: number[], count: number, kind: "bez" | "mendil"): UnitPriceEstimate | null {
  const ref = UNIT_REF.find((u) => u.kind === kind)!.ref;
  const expected = ref * count;
  const usable = prices.filter((p) => p >= expected * 0.2 && p <= expected * 5);
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

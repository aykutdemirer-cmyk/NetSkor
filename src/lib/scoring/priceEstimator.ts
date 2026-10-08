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

/** "500 ml", "2 x 125 g", "1,5 L" -> gram/ml cinsinden miktar */
export function parseQuantity(q?: string): number | null {
  if (!q) return null;
  const m = q.toLowerCase().replace(",", ".").match(/(?:(\d+)\s*x\s*)?(\d+(?:\.\d+)?)\s*(kg|g|gr|l|lt|ml|cl)\b/);
  if (!m) return null;
  const mult = { kg: 1000, g: 1, gr: 1, l: 1000, lt: 1000, ml: 1, cl: 10 }[m[3]]!;
  return (m[1] ? Number(m[1]) : 1) * Number(m[2]) * mult;
}

/** Fiyat snippet'larından ("249,90 TL") sayıları çıkarır. */
export function extractPrices(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:TL|₺)/gi)) {
    const v = Number(m[1].replace(/\./g, "").replace(",", "."));
    if (v >= 5 && v < 100000) out.push(v);
  }
  return out;
}

/** 100 = referansın yarısı veya daha ucuz, 80 = referans fiyat, 40 = referansın 2 katı (referanslar kaba tahmindir). */
export function estimatePrice(category: Category, prices: number[], amount: number | null): PriceEstimate | null {
  if (prices.length === 0) return null;
  const med = median(prices);
  const ref = REF[category];
  const ratio = amount ? med / amount / (ref.per100 / 100) : med / ref.pack;
  const priceScore = Math.round(Math.min(100, Math.max(0, 100 - 40 * (ratio - 0.5))));
  return { priceScore, medianPrice: Math.round(med * 100) / 100, basis: amount ? "unit" : "pack" };
}

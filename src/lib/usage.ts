import { normTr } from "@/lib/text";

export interface Usage { amount: number; unit: "ml" | "g" | "adet"; kind: string; assumption: string }

// Tahmini yıllık tüketim varsayımları (bebek ürünleri, ortalama kullanım) — kaba tahmindir
const USAGE: { kind: string; test: RegExp; amount: number; unit: Usage["unit"]; assumption: string }[] = [
  { kind: "banyo", test: /sampuan|jel|cleansing|sabun|banyo|yikama/, amount: 1200, unit: "ml", assumption: "haftada 3 yıkama, ~10 ml → yılda ~1,2 L" },
  { kind: "krem", test: /krem|merhem|pisik/, amount: 400, unit: "g", assumption: "bez değişimlerinde ara sıra kullanım → yılda ~400 g" },
  { kind: "bez", test: /\b(bez|bezi|diaper)\b/, amount: 2000, unit: "adet", assumption: "günde ~6 bez → yılda ~2000 adet" },
];

export function annualUsage(name: string): Usage | null {
  const t = normTr(name);
  const u = USAGE.find((x) => x.test.test(t));
  return u ? { amount: u.amount, unit: u.unit, kind: u.kind, assumption: u.assumption } : null;
}

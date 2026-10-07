import type { Category } from "@/types";

// Barkod (6-14 hane, productLookup ile aynı kural) -> ürün sayfası; metin -> arama sonuçları
export function resolveSearchTarget(input: string, category: Category): string {
  const v = input.trim();
  if (/^\d{6,14}$/.test(v)) return `/product/${encodeURIComponent(v)}?c=${category}`;
  return `/search?q=${encodeURIComponent(v)}&c=${category}`;
}

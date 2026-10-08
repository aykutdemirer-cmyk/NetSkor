import { analyzeReviews } from "@/lib/scoring/reviewAnalyzer";
import { estimatePrice, parseQuantity } from "@/lib/scoring/priceEstimator";
import { searchReviews } from "./reviewSearch";
import type { ProductAnalysis } from "@/types";

/** Gerçek (API'den gelen) ürünü yorum + fiyat pipeline'ından geçirir. */
export async function enrichWithReviews(base: ProductAnalysis, f?: typeof fetch, env?: Record<string, string | undefined>, extraPrices: number[] = []): Promise<ProductAnalysis> {
  const { product: p } = base;
  // Gramaj sorguya eklenir: fiyat ve yorumlar doğru paket boyutuna yaklaşır
  const qty = base.ageGroup !== "—" ? base.ageGroup.replace(/\s+[a-zA-Z]$/, "") : "";
  const found = await searchReviews({ productName: `${p.name} ${qty}`.trim(), brand: p.brand, category: p.category }, p.barcode, f, env);
  const ra = analyzeReviews(p.category, found.reviews);
  const price = estimatePrice(p.category, [...found.prices, ...extraPrices], parseQuantity(base.ageGroup)); // ageGroup: OFF "quantity" alanı

  return {
    ...base,
    product: { ...base.product, priceTry: price?.medianPrice ?? 0 },
    pros: [...base.pros, ...ra.topPros.map((x) => `${x} (yorumlarda öne çıkıyor)`)],
    cons: [...base.cons, ...ra.topCons.map((x) => `${x} (yorumlarda tekrar ediyor)`)],
    inputs: {
      ...base.inputs,
      reviewSatisfaction: ra.analyzed ? ra.reviewScore : base.inputs.reviewSatisfaction,
      complaintRate: ra.complaintRate,
      valueForMoney: price?.priceScore ?? base.inputs.valueForMoney,
    },
    noSting: ra.analyzed ? ra.noSting : base.noSting,
    reviews: ra.sampleReviews,
    reviewMode: found.mode,
    estimated: { ingredients: base.estimated?.ingredients ?? false, reviews: !ra.analyzed, value: !price },
  };
}

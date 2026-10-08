import { analyzeReviews } from "@/lib/scoring/reviewAnalyzer";
import { categoryAvgPerUnit, estimatePrice, estimateUnitPrice, fmtTl, parseCount, parseQuantityFull, parseQuantity, perHundredText, unitKind, unitRefPerPiece, type PriceEstimate } from "@/lib/scoring/priceEstimator";
import { searchReviews } from "./reviewSearch";
import type { PricePerUnit, ProductAnalysis } from "@/types";

/** Fiyat skoru ve birim fiyat metni: bez/mendil adet başına, diğerleri gramaj/hacim ya da adet başına. */
function priceFor(base: ProductAnalysis, prices: number[]): { est: PriceEstimate | null; unitText?: string; pricePerUnit?: PricePerUnit; avg?: number } {
  const { product: p } = base;
  const count = parseCount(p.name);
  const kind = unitKind(p.name);
  const unitEst = count && kind ? estimateUnitPrice(prices, count, kind.kind) : null;
  const est = unitEst ?? estimatePrice(p.category, prices, parseQuantity(base.ageGroup)); // ageGroup: OFF "quantity" alanı
  if (!est) return { est: null };
  const unitText = unitEst?.unitText ?? (count ? `${fmtTl(est.medianPrice / count)} TL / adet` : perHundredText(est.medianPrice, base.ageGroup));
  // Yapısal birim maliyet ve kategori ortalaması (aynı birimde)
  const qty = parseQuantityFull(base.ageGroup);
  let pricePerUnit: PricePerUnit | undefined, avg: number | undefined;
  if (count && kind) { pricePerUnit = { value: est.medianPrice / count, unit: "adet", label: kind.kind }; avg = unitRefPerPiece(kind.kind); }
  else if (count) pricePerUnit = { value: est.medianPrice / count, unit: "adet" };
  else if (qty) { pricePerUnit = { value: est.medianPrice / qty.amount, unit: qty.unit }; avg = categoryAvgPerUnit(p.category); }
  return { est, unitText, pricePerUnit, avg };
}

/** Gerçek (API'den gelen) ürünü yorum + fiyat pipeline'ından geçirir. */
export async function enrichWithReviews(base: ProductAnalysis, f?: typeof fetch, env?: Record<string, string | undefined>, extraPrices: number[] = []): Promise<ProductAnalysis> {
  const { product: p } = base;
  // Gramaj sorguya eklenir: fiyat ve yorumlar doğru paket boyutuna yaklaşır
  const qty = base.ageGroup !== "—" ? base.ageGroup.replace(/\s+[a-zA-Z]$/, "") : "";
  const found = await searchReviews({ productName: `${p.name} ${qty}`.trim(), brand: p.brand, category: p.category }, p.barcode, f, env);
  const ra = analyzeReviews(p.category, found.reviews);
  const { est: price, unitText, pricePerUnit, avg } = priceFor(base, [...found.prices, ...extraPrices]);

  // Demo (anahtar yok / arama başarısız): gerçek ürünlerde uydurma yorum, uyarı ve skor göstermeyiz
  if (found.mode === "demo") {
    const { est: realPrice, unitText: realUnit, pricePerUnit: realPpu, avg: realAvg } = priceFor(base, extraPrices);
    return {
      ...base,
      unitPrice: realUnit,
      pricePerUnit: realPpu,
      categoryAveragePrice: realAvg,
      product: { ...base.product, priceTry: realPrice?.medianPrice ?? 0 },
      inputs: { ...base.inputs, valueForMoney: realPrice?.priceScore ?? base.inputs.valueForMoney },
      reviews: [],
      reviewMode: "demo",
      estimated: { ingredients: base.estimated?.ingredients ?? false, reviews: true, value: !realPrice },
    };
  }

  return {
    ...base,
    product: { ...base.product, priceTry: price?.medianPrice ?? 0 },
    unitPrice: unitText,
    pricePerUnit,
    categoryAveragePrice: avg,
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

import { describe, expect, it, vi } from "vitest";
import { analyzeReviews } from "@/lib/scoring/reviewAnalyzer";
import { estimatePrice, extractPrices, parseQuantity } from "@/lib/scoring/priceEstimator";
import { demoReviews, searchReviews } from "./reviewSearch";
import { enrichWithReviews } from "./enrich";
import { mapToAnalysis } from "./mapToAnalysis";
import { calculateScore } from "@/lib/scoring";
import type { Review } from "@/types";

const rv = (id: string, rating: 1 | 2 | 3 | 4 | 5, text: string): Review => ({ id, source: "trendyol", author: "a", verifiedBuyer: false, rating, text, flags: [] });

describe("reviewAnalyzer", () => {
  const list = [
    rv("1", 5, "Hızlı iyileşme, alerji yapmadı, çok memnun kaldım"),
    rv("2", 2, "Bebeğimde kızarıklık ve pişik yaptı"),
    rv("3", 1, "Kokusu ağır, alerji şüphesi"),
    rv("4", 4, "Fiyat performans, kokusu güzel"),
  ];
  const a = analyzeReviews("baby", list);
  it("olumsuzlama şikayet sayılmaz; oran doğru", () => {
    expect(a.complaintRate).toBe(0.5); // 2/4 (1. yorumda "alerji yapmadı" sayılmaz)
    expect(a.topCons.length).toBe(2);
  });
  it("puan ve örnekler", () => {
    expect(a.reviewScore).toBe(Math.round(((3 - 1) / 4) * 100)); // ort 3.0 -> 50
    expect(a.sampleReviews.length).toBeGreaterThanOrEqual(3);
    expect(a.sampleReviews.some((r) => r.flags.some((f) => f.kind === "risk"))).toBe(true);
  });
  it("boş liste", () => expect(analyzeReviews("food", []).analyzed).toBe(false));
});

describe("priceEstimator", () => {
  it("snippet fiyatları", () => expect(extractPrices("Sudocrem 1.249,90 TL, kargo 29 ₺, 3 TL, Fiyat : ₺151,50")).toEqual([1249.9, 29, 151.5]));
  it("miktar", () => { expect(parseQuantity("2 x 125 g")).toBe(250); expect(parseQuantity("1,5 L")).toBe(1500); });
  it("birim fiyat ucuz -> yüksek skor", () => {
    expect(estimatePrice("baby", [139], 700)!.priceScore).toBe(100);
    expect(estimatePrice("baby", [649], 500)!.priceScore).toBeLessThan(estimatePrice("baby", [139], 700)!.priceScore);
    expect(estimatePrice("baby", [], 500)).toBeNull();
  });
});

describe("reviewSearch", () => {
  const input = { productName: "Test Şampuan", brand: "Marka", category: "baby" as const };
  it("anahtar yoksa deterministik demo", async () => {
    const f = vi.fn();
    const a = await searchReviews(input, "123456789", f as unknown as typeof fetch, {});
    const b = await searchReviews(input, "123456789", f as unknown as typeof fetch, {});
    expect(a).toEqual(b);
    expect(a.mode).toBe("demo");
    expect(f).not.toHaveBeenCalled();
    expect(demoReviews(input, "999999").reviews).not.toEqual(a.reviews);
  });
  it("SerpAPI hatasında demo'ya düşer", async () => {
    const f = vi.fn().mockRejectedValue(new Error("net"));
    expect((await searchReviews(input, "1", f as unknown as typeof fetch, { SERPAPI_KEY: "k" })).mode).toBe("demo");
  });
  it("SerpAPI canlı yanıt: kaynak ve fiyat", async () => {
    const f = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ organic_results: [{ title: "x", link: "https://www.trendyol.com/p/1", snippet: "Hassas cilde uygun, 139,90 TL", rich_snippet: { top: { detected_extensions: { rating: 4.6 } } } }] })));
    const r = await searchReviews(input, "1", f as unknown as typeof fetch, { SERPAPI_KEY: "k" });
    expect(r.mode).toBe("live");
    expect(f).toHaveBeenCalledTimes(4);
    expect(r.reviews[0]).toMatchObject({ source: "trendyol", rating: 5 });
    expect(r.prices).toContain(139.9);
  });
});

describe("enrich", () => {
  it("anahtar yokken (demo): uydurma yorum/uyarı gösterilmez, yorum ve fiyat 'veri yok'", async () => {
    const base = mapToAnalysis({ barcode: "8690504000001", name: "Test Krem", brand: "Marka", ingredientsText: "Aqua, Glycerin", analysisTags: [], quantity: "125 g", source: "openbeautyfacts" }, "baby");
    const e = await enrichWithReviews(base, vi.fn() as unknown as typeof fetch, {});
    expect(e.reviewMode).toBe("demo");
    expect(e.reviews).toEqual([]);
    expect(e.cons).toEqual(base.cons);
    expect(e.pros).toEqual(base.pros);
    expect(e.estimated).toEqual({ ingredients: false, reviews: true, value: true });
  });
  it("demo modda web fiyatı varsa kullanılır", async () => {
    const base = mapToAnalysis({ barcode: "1", name: "Test", brand: "M", ingredientsText: "Aqua", analysisTags: [], source: "web" }, "baby");
    const e = await enrichWithReviews(base, vi.fn() as unknown as typeof fetch, {}, [150]);
    expect(e.product.priceTry).toBe(150);
    expect(e.estimated?.value).toBe(false);
  });
  it("canlı modda tahmin bayrakları kalkar, skor dinamik", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ organic_results: [{ title: "t", link: "https://www.trendyol.com/p", snippet: "Güzel koku, uygun fiyat 120 TL" }] }))) as unknown as typeof fetch;
    const base = mapToAnalysis({ barcode: "8690504000001", name: "Test Krem", brand: "Marka", ingredientsText: "Aqua, Glycerin", analysisTags: [], quantity: "125 g", source: "openbeautyfacts" }, "baby");
    const e = await enrichWithReviews(base, f, { SERPAPI_KEY: "k" });
    expect(e.reviewMode).toBe("live");
    expect(e.reviews.length).toBeGreaterThan(0);
    expect(e.estimated).toEqual({ ingredients: false, reviews: false, value: false });
    expect(calculateScore("baby", e.inputs).total).toBeGreaterThan(0);
  });
});

describe("canlı arama kalitesi", () => {
  const input = { productName: "Nutella", brand: "Ferrero", category: "food" as const };
  it("sikayetvar.com sonuçları elenir; yalnızca şikayet sitesiyse demo'ya düşer", async () => {
    const mk = (link: string) => vi.fn(async () => new Response(JSON.stringify({ organic_results: [{ title: "x", link, snippet: "Aldığım ürünün tarihi geçmiş çıktı, çok kötü bir deneyim yaşadık" }] }))) as unknown as typeof fetch;
    expect((await searchReviews(input, "1", mk("https://www.sikayetvar.com/nutella"), { SERPAPI_KEY: "k" })).mode).toBe("demo");
    expect((await searchReviews(input, "1", mk("https://www.trendyol.com/p/1"), { SERPAPI_KEY: "k" })).mode).toBe("live");
  });
  it("tahmini yıldız: şikayet metni yüksek puan almaz", async () => {
    const { inferRating } = await import("@/lib/scoring/reviewAnalyzer");
    expect(inferRating("Son zamanlarda tadında değişiklik fark ettim, lezzetli değil", "food")).toBeLessThanOrEqual(2);
    expect(inferRating("Çok lezzetli, tadı harika", "food")).toBeGreaterThanOrEqual(4);
  });
  it("fiyat: Nutella 400 g ~180 TL artık 0 değil", () => {
    expect(estimatePrice("food", [180], 400)!.priceScore).toBeGreaterThan(20);
  });
});

describe("fiyat aykırı değer filtresi", () => {
  it("alakasız büyük sayılar elenir; güvenilir fiyat yoksa null", () => {
    // 400 g gıda: beklenen ~140 TL; 5.000 TL ve 3 TL elenir
    expect(estimatePrice("food", [5000, 180, 190, 3], 400)!.medianPrice).toBe(185);
    expect(estimatePrice("food", [5000, 9999], 400)).toBeNull();
  });
});

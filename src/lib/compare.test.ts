import { describe, expect, it, vi } from "vitest";
import { compareProducts } from "./compare";
import { enrichProduct } from "./api/enrichProduct";
import { analyzeReviews } from "./scoring/reviewAnalyzer";
import { MOCK_PRODUCTS as M } from "@/data/mockProducts";
import type { Review } from "@/types";

const obf = (code: string, name: string, brands: string, ingredients: string, quantity: string) =>
  new Response(JSON.stringify({ status: 1, product: { code, product_name: name, brands, ingredients_text: ingredients, quantity } }));
const miss = () => new Response(JSON.stringify({ status: 0 }));
const rv = (id: string, text: string, rating: 1 | 2 | 3 | 4 | 5 = 4): Review => ({ id, source: "trendyol", author: "a", verifiedBuyer: false, rating, text, flags: [] });

describe("compareProducts (mock)", () => {
  it("Mustela, Dalin'e karşı önde; ağırlıklar 1.0", () => {
    const r = compareProducts(M["8690605061158"], M["3504105035600"]);
    expect(r.criteria.reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1);
    expect(r.winner).toBe("b");
    expect(r.verdict.some((v) => v.includes("Fiyat") && v.includes("Dalin"))).toBe(true);
    expect(r.mixedCategories).toBe(false);
  });
});

describe("dinamik barkodlarla karşılaştırma", () => {
  const f = vi.fn(async (u: string) => {
    if (u.includes("9990000000001")) return obf("9990000000001", "Temiz Bebek Kremi", "Eko", "Aqua, Glycerin", "100 ml");
    if (u.includes("9990000000002")) return obf("9990000000002", "Parfümlü Bebek Kremi", "Kimya", "Aqua, Parfum, Methylparaben, Phenoxyethanol", "100 ml");
    return miss();
  }) as unknown as typeof fetch;

  it("enrichProduct: mock öncelikli, API'de olmayan null", async () => {
    expect((await enrichProduct("5011091104752", "baby", f))?.product.brand).toBe("Sudocrem");
    expect(f).not.toHaveBeenCalled();
    expect(await enrichProduct("9999999999999", "baby", f, {})).toBeNull();
  });

  it("iki gerçek ürün: temiz içerik önde, karar özeti ve demo notu", async () => {
    const [A, B] = await Promise.all([enrichProduct("9990000000001", "baby", f, {}), enrichProduct("9990000000002", "baby", f, {})]);
    expect(A && B).toBeTruthy();
    const r = compareProducts(A!, B!);
    expect(r.criteria).toHaveLength(4); // bebek seti: noSting dahil
    expect(r.verdict.join(" ")).toContain("Not:"); // demo yorum verisi uyarısı
    expect(r.criteria.find((c) => c.key === "natural")!.a).toBeGreaterThanOrEqual(r.criteria.find((c) => c.key === "natural")!.b);
  });

  it("mock + gerçek karışık ve kategori farkı", async () => {
    const food = vi.fn(async () => obf("9990000000003", "Kakaolu Bisküvi", "Lezzet", "Şeker, palm yağı, E322", "200 g")) as unknown as typeof fetch;
    const G = await enrichProduct("9990000000003", "food", food, {});
    const r = compareProducts(M["3504105035600"], G!);
    expect(r.mixedCategories).toBe(true);
    expect(r.criteria.reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1);
    expect(r.verdict.join(" ")).toContain("farklı kategorilerde");
  });
});

describe("noSting türetimi", () => {
  it("göz yakmaz yorumları yükseltir, göz yaktı düşürür, veri yoksa nötr", () => {
    expect(analyzeReviews("baby", [rv("1", "Gözünü yakmıyor"), rv("2", "Gözü yakmadı, güzel")]).noSting).toBeGreaterThan(70);
    expect(analyzeReviews("baby", [rv("1", "Bebeğin gözünü yaktı", 1), rv("2", "Gözü yanıyor diye ağladı", 1)]).noSting).toBeLessThan(70);
    expect(analyzeReviews("baby", [rv("1", "Normal ürün")]).noSting).toBe(70);
    expect(analyzeReviews("baby", []).noSting).toBe(70);
  });
});

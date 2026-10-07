import { describe, expect, it, vi } from "vitest";
import { lookupProduct } from "./productLookup";
import { mapToAnalysis } from "./mapToAnalysis";
import { analyzeIngredients } from "@/lib/scoring/ingredientAnalyzer";

const ok = (p: object) => new Response(JSON.stringify({ status: 1, product: p }));
const miss = () => new Response(JSON.stringify({ status: 0 }));

describe("lookupProduct", () => {
  it("bebek: OBF'de yoksa OFF'e düşer", async () => {
    const f = vi.fn().mockResolvedValueOnce(miss()).mockResolvedValueOnce(ok({ product_name: "Bebek Bisküvisi", brands: "Ülker, X", nutriscore_grade: "b" }));
    const r = await lookupProduct("8690504000001", "baby", f as unknown as typeof fetch);
    expect(r?.source).toBe("openfoodfacts");
    expect(r?.brand).toBe("Ülker");
    expect(f.mock.calls[0][0]).toContain("openbeautyfacts");
  });
  it("gıda: önce OFF; ağ hatasında null", async () => {
    const f = vi.fn().mockRejectedValue(new Error("net"));
    expect(await lookupProduct("8690504000001", "food", f as unknown as typeof fetch)).toBeNull();
    expect(f.mock.calls[0][0]).toContain("openfoodfacts");
  });
  it("geçersiz barkod istek atmaz", async () => {
    const f = vi.fn();
    expect(await lookupProduct("sudocrem", "baby", f as unknown as typeof fetch)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});

describe("ingredientAnalyzer", () => {
  it("kozmetik riskleri", () => {
    const a = analyzeIngredients("baby", "Aqua, Sodium Laureth Sulfate, Parfum, Methylparaben, Phenoxyethanol");
    expect(a.risks.map((r) => r.id).sort()).toEqual(["fragrance", "paraben", "phenoxyethanol", "sls"]);
    expect(a.ingredientScore).toBe(30);
  });
  it("gıda riskleri", () => {
    const a = analyzeIngredients("food", "Şeker, palm yağı, glukoz şurubu, E322");
    expect(a.ingredientScore).toBe(55);
  });
  it("temiz içerik 100, boş içerik analiz edilmedi", () => {
    expect(analyzeIngredients("baby", "Aqua, Glycerin").ingredientScore).toBe(100);
    expect(analyzeIngredients("baby", "").analyzed).toBe(false);
  });
  it("eşleme: veri yoksa tahmini işaretlenir", () => {
    const d = mapToAnalysis({ barcode: "1", name: "X", brand: "", analysisTags: [], source: "openbeautyfacts" }, "baby");
    expect(d.estimated?.ingredients).toBe(true);
  });
});

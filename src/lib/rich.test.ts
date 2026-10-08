import { describe, expect, it } from "vitest";
import { MOCK_PRODUCTS as M } from "@/data/mockProducts";
import { contentChecks, costCompare, scenarioPicks } from "./compare";
import { buildChecklist, buildHighlights } from "./scoring/inciHighlights";
import { vsAverage } from "./scoring/priceEstimator";
import { annualUsage } from "./usage";
import { mapToAnalysis } from "./api/mapToAnalysis";

const budget0Title = () => scenarioPicks(M["8690605061158"], M["3504105035600"])[1].title;
const dalin = M["8690605061158"], mustela = M["3504105035600"], sudocrem = M["5011091104752"];

describe("zengin mock veri", () => {
  it("üç ürün de yeni alanları taşır", () => {
    for (const d of [dalin, mustela, sudocrem]) {
      expect(d.inciHighlights?.length).toBeGreaterThan(0);
      expect(d.pricePerUnit && d.categoryAveragePrice).toBeTruthy();
      expect(d.ageGroupSatisfaction).toHaveLength(3);
      expect(d.featureChecklist).toBeTruthy();
    }
    expect(dalin.ageGroupSatisfaction?.[0].pct).toBe(72);
    expect(dalin.ageGroupSatisfaction?.[2].pct).toBe(94);
  });
  it("kategori ortalamasına göre fark: Dalin %63 daha ucuz, Mustela daha pahalı", () => {
    expect(vsAverage(dalin.pricePerUnit!.value, dalin.categoryAveragePrice!).text).toBe("kategori ortalamasına göre %63 daha ucuz");
    expect(vsAverage(mustela.pricePerUnit!.value, mustela.categoryAveragePrice!).text).toContain("daha pahalı");
    expect(vsAverage(1.0, 1.01).text).toBe("kategori ortalamasına yakın");
  });
});

describe("karşılaştırma: içerik, maliyet, senaryo", () => {
  it("içerik röntgeni: sülfat, parfüm, koruyucu, onay", () => {
    const rows = contentChecks(dalin, mustela);
    expect(rows.map((r) => r.label)).toEqual(["Sülfat (SLS / SLES)", "Parfüm / Koku", "Koruyucu Türü", "Klinik / Pediatrik Onay", "Doğallık"]);
    expect(rows[0]).toMatchObject({ a: { text: "Var", tone: "bad" }, b: { text: "Yok", tone: "ok" } });
    expect(rows[1]).toMatchObject({ a: { text: "Sentetik parfüm", tone: "warn" }, b: { text: "Karakteristik koku", tone: "warn" } });
    expect(rows[2]).toMatchObject({ a: { text: "Fenoksietanol", tone: "warn" }, b: { text: "Nazik koruyucu", tone: "ok" } });
    expect(rows[3]).toMatchObject({ a: { text: "Yok", tone: "bad" }, b: { tone: "ok" } });
    expect(rows[3].b.text).toContain("Dermatolojik test");
    expect(rows[4]).toMatchObject({ a: { text: "%20", tone: "bad" }, b: { text: "%92", tone: "ok" } });
    // bilinmeyen alan: tire, ton yok
    expect(contentChecks({ ...dalin, featureChecklist: undefined }, mustela)[0].a).toEqual({ text: "—", tone: null });
  });
  it("fragrance notu yoksa fragranceFree'den türetilir", () => {
    const base = { ...dalin.featureChecklist!, fragrance: undefined };
    expect(contentChecks({ ...dalin, featureChecklist: { ...base, fragranceFree: true } }, mustela)[1].a).toEqual({ text: "Parfümsüz", tone: "ok" });
    expect(contentChecks({ ...dalin, featureChecklist: { ...base, fragranceFree: false } }, mustela)[1].a).toEqual({ text: "Parfüm içerir", tone: "warn" });
  });

  it("100 ml birim maliyeti ve yıllık fark", () => {
    const c = costCompare(dalin, mustela);
    expect(c.a.text).toBe("19,86 TL / 100 ml");
    expect(c.b.text).toBe("129,80 TL / 100 ml");
    expect(c).toMatchObject({ comparable: true, cheaper: "a", diffPct: 85, ratio: 6.5 });
    expect(c.yearly).toMatchObject({ a: 238, b: 1558, diff: 1320, cheaper: "a" });
    // farklı birim (g vs ml): kıyaslanamaz, yıllık yok
    const mixed = costCompare(sudocrem, dalin);
    expect(mixed.comparable).toBe(false);
    expect(mixed.yearly).toBeUndefined();
  });

  it("senaryolar: hassas cilt Mustela, bütçe Dalin; gerekçeler dolu", () => {
    const [sensitive, budget] = scenarioPicks(dalin, mustela);
    expect(sensitive.title).toBe("Yenidoğan / Hassas Ciltler İçin");
    expect(budget0Title()).toBe("Bütçe Dostu / Günlük Kullanım İçin");
    expect(sensitive.winner).toBe("b");
    expect(sensitive.reasons.join(" ")).toContain("sülfat");
    expect(sensitive.reasons.join(" ")).toContain("sentetik parfüm içermiyor");
    expect(budget.winner).toBe("a");
    expect(budget.reasons.join(" ")).toContain("%85 daha ucuz");
    expect(budget.reasons.some((r) => r.includes("yıllık"))).toBe(true);
  });

  it("aynı ürün: başa baş", () => {
    expect(scenarioPicks(dalin, dalin).map((s) => s.winner)).toEqual(["tie", "tie"]);
  });

  it("yıllık tüketim varsayımı türe göre", () => {
    expect(annualUsage("Dalin Bebek Şampuanı 700ml")?.kind).toBe("banyo");
    expect(annualUsage("Sudocrem Pişik Kremi")?.kind).toBe("krem");
    expect(annualUsage("Molfix Bebek Bezi")?.kind).toBe("bez");
    expect(annualUsage("Çikolata")).toBeNull();
  });
});

describe("INCI vurguları (gerçek ürünler için türetme)", () => {
  it("riskli, dikkat ve faydalı bileşenler sıralı gruplanır", () => {
    const h = buildHighlights("baby", ["Aqua", "Glycerin", "Sodium Laureth Sulfate", "Parfum", "Phenoxyethanol", "Methylparaben", "Glycerin"]);
    expect(h.map((x) => `${x.tone}:${x.name}`)).toEqual([
      "risk:Sodium Laureth Sulfate", "risk:Methylparaben", "warn:Parfum", "warn:Phenoxyethanol", "good:Glycerin",
    ]);
  });
  it("kontrol listesi: listeden, yoksa beyandan, ikisi de yoksa bilinmiyor", () => {
    expect(buildChecklist("baby", "Aqua, Coco-Glucoside, Glycerin, Potassium Sorbate")).toMatchObject({ sulfateFree: true, fragranceFree: true, fragrance: { tone: "ok" }, preservative: { tone: "ok", text: "Nazik koruyucu" } });
    expect(buildChecklist("baby", "Aqua, Sodium Laureth Sulfate, Parfum, Phenoxyethanol")).toMatchObject({ sulfateFree: false, fragranceFree: false, fragrance: { tone: "warn" }, preservative: { tone: "warn", text: "Fenoksietanol" } });
    expect(buildChecklist("baby", "Aqua, Methylparaben, Glycerin").preservative).toEqual({ tone: "bad", text: "Paraben" });
    expect(buildChecklist("baby", undefined, ["Parfümsüz", "Dermatolojik test"])).toMatchObject({ sulfateFree: null, fragranceFree: true, certificates: ["Dermatolojik test"], fragrance: { tone: "ok" } });
    expect(buildChecklist("baby", undefined)).toMatchObject({ sulfateFree: null, fragranceFree: null, naturalPct: null });
  });
  it("mapToAnalysis yeni alanları doldurur", () => {
    const d = mapToAnalysis({ barcode: "1", name: "X Şampuan", brand: "X", ingredientsText: "Aqua, Sodium Laureth Sulfate, Glycerin", analysisTags: [], source: "openbeautyfacts" }, "baby");
    expect(d.inciHighlights?.map((x) => x.tone)).toEqual(["risk", "good"]);
    expect(d.featureChecklist?.sulfateFree).toBe(false);
  });
});

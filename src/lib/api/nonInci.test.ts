import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimScore, isNonInci, scanClaims } from "@/lib/scoring/claimScanner";
import { estimateUnitPrice, parseCount, parseQuantityFull, perHundredText } from "@/lib/scoring/priceEstimator";
import { getConfidence } from "@/lib/confidence";
import { enrichProduct } from "./enrichProduct";
import { _clearMemoryCache } from "@/lib/cache";
import { _resetProviders } from "./searchProviders";

beforeEach(() => { _clearMemoryCache(); _resetProviders(); });

describe("beyan taraması", () => {
  it("bez/mendil INCI'siz ürün; beyanlar bulunur", () => {
    expect(isNonInci("Molfix 3D Eko Paket Mini 36Lı Bebek Bezi")).toBe(true);
    expect(isNonInci("Sleepy Islak Mendil 90'lı")).toBe(true);
    expect(isNonInci("Bezelye Konservesi")).toBe(false);
    expect(scanClaims("Parfümsüz, pamuksu dokulu, losyonsuz ve klor içermez bebek bezi")).toEqual(["Parfümsüz", "Pamuksu", "Losyonsuz", "Klor içermez"]);
    expect(scanClaims("Bebek bezi 36'lı")).toEqual([]);
  });
  it("beyan puanı en çok 85", () => {
    expect(claimScore(0)).toBe(65);
    expect(claimScore(2)).toBe(79);
    expect(claimScore(8)).toBe(85);
  });
});

describe("adet ve birim fiyat", () => {
  it("adet ifadeleri", () => {
    for (const t of ["Molfix 36Lı", "Molfix 36'lı", "Molfix 36 lı", "Molfix 36 adet", "36 Ad"]) expect(parseCount(t)).toBe(36);
    expect(parseCount("Bez 700ml")).toBeNull();
    expect(parseCount("2'li paket")).toBeNull(); // çoklu paket, adet değil
    expect(parseCount("3-6 kg 36 sany")).toBeNull();
  });
  it("gramaj / hacim birimi", () => {
    expect(parseQuantityFull("700ml")).toEqual({ amount: 700, unit: "ml" });
    expect(parseQuantityFull("1,5 L")).toEqual({ amount: 1500, unit: "ml" });
    expect(parseQuantityFull("36Lı")).toBeNull(); // "36L" litre değil
    expect(perHundredText(139, "700 ml")).toBe("19,86 TL / 100 ml");
  });
  it("bez birim fiyatı: 151,50 TL / 36 = 4,21 TL / bez; aykırı fiyat elenir", () => {
    const e = estimateUnitPrice([151.5, 5000, 3], 36, "bez");
    expect(e?.unitText).toBe("4,21 TL / bez");
    expect(e!.priceScore).toBeGreaterThan(80);
    expect(estimateUnitPrice([9999], 36, "bez")).toBeNull();
  });
});

// Molfix: Open Facts'te yok, web'de var; INCI yok, yorumlar ve fiyat var
const serp = vi.fn(async (u: string) => {
  if (u.includes("openfoodfacts") || u.includes("openbeautyfacts")) return new Response(JSON.stringify({ status: 0 }));
  const url = new URL(u), q = url.searchParams.get("q") ?? "";
  if (q.includes("içindekiler")) return new Response(JSON.stringify({ organic_results: [] }));
  if (q.includes("8690536821129") && !q.includes("yorumlar")) return new Response(JSON.stringify({ organic_results: [
    { title: "Molfix 3D Eko Paket Mini 36Lı Bebek Bezi 8690536821129", link: "https://www.toptantr.com.tr/m", snippet: "Parfümsüz ve pamuksu yüzey. Barkod 8690536821129. Fiyat : ₺151,50" },
    { title: "Molfix Bebek Bezi 3D Eko Paket Mini 36'lı", link: "https://www.hepsiburada.com/m", snippet: "EAN 8690536821129 klor içermez" },
  ] }));
  return new Response(JSON.stringify({ organic_results: [
    { title: "t", link: "https://www.trendyol.com/a", snippet: "Bebeğimin cildinde pişik yapmadı, çok memnun kaldım, kargo da hızlıydı" },
    { title: "t", link: "https://www.hepsiburada.com/b", snippet: "Hızlı kargo, satıcı iyi paketlemiş, kurye çok nazikti, teşekkürler" },
  ] }));
}) as unknown as typeof fetch;

describe("Molfix uçtan uca", () => {
  it("INCI yok -> beyan puanı, kullanıcı deneyimi koşulu, birim fiyat, teslimat yorumu elenir", async () => {
    const r = await enrichProduct("8690536821129", "food", serp, { SERPAPI_KEY: "k" });
    expect(r).toMatchObject({ productSource: "web", contentBasis: "claims" });
    expect(r!.product.category).toBe("baby");
    expect(r!.claims).toEqual(expect.arrayContaining(["Parfümsüz", "Pamuksu", "Klor içermez"]));
    expect(r!.inputs.ingredientSafety).toBe(85); // 65+7*3=86, doğrulanmamış beyan tavanı 85
    expect(r!.unitPrice).toBe("4,21 TL / bez");
    expect(r!.reviews.every((x) => !/kurye/i.test(x.text))).toBe(true); // yalnızca teslimat yorumu elendi
    expect(r!.reviews.length).toBeGreaterThan(0);
    const c = getConfidence(r!);
    expect(c).toMatchObject({ ingredients: "claim", showScore: true });
  });

  it("beyan da yoksa: kullanıcı deneyimi skoru koşulu sağlanır (içerik yok, yorum ve fiyat var)", () => {
    const base = { ingredients: "none", reviews: "low", price: "low" } as const;
    const c = getConfidence({ estimated: { ingredients: true, reviews: false, value: false }, reviewMode: "live", productSource: "web" } as never);
    expect(c).toMatchObject({ ingredients: base.ingredients, reviews: base.reviews, price: base.price, showScore: false, experience: true });
    const none = getConfidence({ estimated: { ingredients: true, reviews: true, value: false }, reviewMode: "demo", productSource: "web" } as never);
    expect(none.experience).toBe(false); // yorum yoksa deneyim skoru da yok
  });
});

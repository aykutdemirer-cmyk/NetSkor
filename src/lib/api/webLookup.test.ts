import { beforeEach, describe, expect, it, vi } from "vitest";
import { _clearMemoryCache } from "@/lib/cache";
import { cleanTitle, consensusTitle, extractIngredients, webLookupProduct } from "./webLookup";
import { enrichProduct } from "./enrichProduct";

beforeEach(() => _clearMemoryCache());

describe("webLookup yardımcıları", () => {
  it("başlık temizleme", () => {
    expect(cleanTitle("Nutella 400 g Fiyatı - Migros")).toBe("Nutella 400 g");
    expect(cleanTitle("Ülker Çikolatalı Gofret | Satın Al")).toBe("Ülker Çikolatalı Gofret");
  });
  it("uzlaşılan başlık: uyumsuz mağaza başlığı elenir", () => {
    expect(consensusTitle(["Nutella 400 g", "Ferrero Nutella 400 g Kakaolu Fındık Kreması", "Nutella Kakaolu Fındık Kreması 400 g", "Bambaşka Ürün Kutusu"])).toMatch(/Nutella/);
    expect(consensusTitle([])).toBe("");
  });
  it("içindekiler çıkarma", () => {
    expect(extractIngredients("Ürün bilgisi. İçindekiler: Şeker, palm yağı, fındık (%13), yağsız kakao. Besin değerleri")).toBe("Şeker, palm yağı, fındık (%13), yağsız kakao");
    expect(extractIngredients("içerik yok")).toBeUndefined();
  });
});

// SerpAPI sahte yanıtı: barkod sorgusunda sonuç metninde barkod geçer; shopping yalnızca ürün adıyla sorgulanır
const serpMock = () => vi.fn(async (u: string) => {
  if (u.includes("serpapi.com")) {
    const url = new URL(u), engine = url.searchParams.get("engine"), q = url.searchParams.get("q") ?? "";
    if (engine === "google_shopping") return new Response(JSON.stringify({ shopping_results: [
      { title: "Sarelle Kakaolu Fındık Ezmesi 350 g - Migros", extracted_price: 120, thumbnail: "https://img/x.jpg" },
      { title: "Sarelle Kakaolu Fındık Ezmesi 350g | A101", extracted_price: 115 },
      { title: "GARNIER Micellar Makyaj Temizleme Suyu", extracted_price: 313, thumbnail: "https://img/garnier.jpg" }, // alakasız: filtrelenmeli
    ] }));
    if (q.includes("içindekiler")) return new Response(JSON.stringify({ organic_results: [{ snippet: "İçindekiler: Şeker, palm yağı, fındık, yağsız kakao, emülgatör. Saklama" }] }));
    if (q.includes("8690000000099")) return new Response(JSON.stringify({ organic_results: [
      { title: "Sarelle Kakaolu Fındık Ezmesi 350 g 8690000000099", link: "https://a.com/1", snippet: "Barkod: 8690000000099" },
      { title: "Sarelle Kakaolu Fındık Ezmesi 350 g - Migros", link: "https://b.com/2", snippet: "EAN 8690000000099" },
    ] }));
    return new Response(JSON.stringify({ organic_results: [{ title: "Yorum", link: "https://www.trendyol.com/p", snippet: "Güzel koku, uygun fiyat" }] }));
  }
  return new Response(JSON.stringify({ status: 0 })); // Open Facts: kayıt yok
}) as unknown as typeof fetch;

describe("webLookupProduct", () => {
  it("anahtar yok / geçersiz barkod -> istek atmaz", async () => {
    const f = vi.fn();
    expect(await webLookupProduct("8690000000099", "food", f as unknown as typeof fetch, {})).toBeNull();
    expect(await webLookupProduct("abc", "food", f as unknown as typeof fetch, { SERPAPI_KEY: "k" })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it("ad, görsel, fiyat ve içerik çıkarılır", async () => {
    const r = await webLookupProduct("8690000000099", "food", serpMock(), { SERPAPI_KEY: "k" });
    expect(r).toMatchObject({ name: expect.stringContaining("Sarelle"), imageUrl: "https://img/x.jpg", source: "web", quantity: "350 g" });
    expect(r!.name).not.toMatch(/\d{8,}/); // başlıktaki barkod temizlendi
    expect(r!.prices).toEqual([120, 115]); // alakasız Garnier (313 TL) ve görseli alınmadı
    expect(r!.ingredientsText).toContain("palm yağı");
  });
  it("hata olursa null", async () => {
    const f = vi.fn(async () => { throw new Error("net"); }) as unknown as typeof fetch;
    expect(await webLookupProduct("8690000000099", "food", f, { SERPAPI_KEY: "k" })).toBeNull();
  });
});

describe("enrichProduct web yedeği", () => {
  it("Open Facts'te yoksa internetten bulur, içerik ve fiyat skorlanır", async () => {
    const r = await enrichProduct("8690000000099", "food", serpMock(), { SERPAPI_KEY: "k" });
    expect(r?.productSource).toBe("web");
    expect(r?.product.category).toBe("food");
    expect(r?.cons.join(" ")).toContain("Palm yağı");
    expect(r?.product.priceTry).toBeGreaterThan(0);
    expect(r?.estimated?.ingredients).toBe(false);
  });
  it("anahtar yoksa null (bulunamadı kartı)", async () => {
    expect(await enrichProduct("8690000000099", "food", serpMock(), {})).toBeNull();
  });
});

describe("regresyon: yanlış ürün (Garnier / diş fırçası görseli)", () => {
  it("barkodla alakasız Shopping sonuçları ürün adı, görsel ve fiyat olarak kullanılmaz", async () => {
    const f = vi.fn(async (u: string) => {
      const url = new URL(u), engine = url.searchParams.get("engine"), q = url.searchParams.get("q") ?? "";
      if (engine === "google_shopping") return new Response(JSON.stringify({ shopping_results: [{ title: "GARNIER Micellar Kusursuz Makyaj Temizleme Suyu", extracted_price: 313, thumbnail: "https://img/firca.jpg" }] }));
      if (q.includes("içindekiler")) return new Response(JSON.stringify({ organic_results: [] }));
      return new Response(JSON.stringify({ organic_results: [
        { title: "Molfix Bebek Bezi Jumbo 2 Mini 36'lı 8690536821129", link: "https://www.toptantr.com/m", snippet: "doğal bambu" },
        { title: "Molfix Bantlı Bebek Bezi 2 Numara 36 Adet Jumbo Paket", link: "https://www.asyasanalmarket.com/m", snippet: "Barkod : 8690536821129. Fiyat : ₺151,50" },
      ] }));
    }) as unknown as typeof fetch;
    const r = await webLookupProduct("8690536821129", "baby", f, { SERPAPI_KEY: "k" });
    expect(r?.name).toContain("Molfix");
    expect(r?.name).not.toContain("GARNIER");
    expect(r?.imageUrl).toBeUndefined(); // diş fırçası görseli gelmedi
    expect(r?.prices).toEqual([151.5]);
  });
});

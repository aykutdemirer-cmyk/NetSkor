import { describe, expect, it, vi } from "vitest";
import { relevance, searchMock, searchProducts } from "./productSearch";
import { resolveSearchTarget } from "@/lib/routing";

const resp = (products: object[]) => new Response(JSON.stringify({ products }));
const off = (code: string, name: string, brands: string, tags: string[] = []) => ({ code, product_name: name, brands, categories_tags: tags });
const F = (impl: (url: string) => Promise<Response>) => vi.fn(impl) as unknown as typeof fetch;

describe("resolveSearchTarget", () => {
  it("barkod -> ürün, metin -> arama", () => {
    expect(resolveSearchTarget("5011091104752", "baby")).toBe("/product/5011091104752?c=baby");
    expect(resolveSearchTarget(" nutella 750 ", "food")).toBe("/search?q=nutella%20750&c=food");
    expect(resolveSearchTarget("12345", "food")).toContain("/search?");
  });
});

describe("relevance / mock", () => {
  it("fuzzy ve Türkçe karakter", () => {
    expect(searchMock("sudocrem").map((c) => c.brand)).toEqual(["Sudocrem"]);
    expect(searchMock("sudokrem")).toHaveLength(1); // 1 harf hata toleransı
    expect(searchMock("sudoxxem")).toEqual([]);
  });
  it("alakasız sorgu", () => {
    expect(searchMock("zzzz")).toEqual([]);
    expect(relevance("dalin sampuan", { name: "Dalin Bebek Şampuanı 700ml", brand: "Dalin" })).toBeGreaterThanOrEqual(1);
  });
});

describe("searchProducts", () => {
  it("bebek: OBF + OFF birleşir, tekrarsız, en fazla 6, alakaya göre sıralı", async () => {
    const many = Array.from({ length: 10 }, (_, i) => off(`86900000000${i}0`, `Krem ${i}`, "Marka"));
    const f = F(async (u) => (u.includes("beauty") ? resp([off("8690000000001", "Nutella Krem", "X"), ...many]) : resp([off("8690000000001", "Nutella Krem", "X"), off("3017620422003", "Nutella 750g", "Ferrero")])));
    const r = await searchProducts("nutella 750", "baby", f);
    expect(r.length).toBeLessThanOrEqual(6);
    expect(new Set(r.map((c) => c.barcode)).size).toBe(r.length);
    expect(r[0].barcode).toBe("3017620422003");
  });
  it("kategori tespiti ve geçersiz barkod/boş ad elenir", async () => {
    const f = F(async (u) => (u.includes("openfoodfacts") ? resp([off("3017620422003", "Nutella", "Ferrero"), off("abc", "Bozuk", "x"), off("1111111111111", "", "x")]) : resp([off("3600523000001", "Baby Diaper", "Pampers", ["en:baby-care"])])));
    const r = await searchProducts("nutella", "food", f);
    expect(r.find((c) => c.barcode === "3017620422003")?.category).toBe("food");
    expect(r.some((c) => c.barcode === "abc")).toBe(false);
  });
  it("ağ hatasında mock'a düşer", async () => {
    const f = F(async () => { throw new Error("net"); });
    const r = await searchProducts("sudocrem", "cosmetics", f);
    expect(r).toHaveLength(1);
    expect(r[0].barcode).toBe("5011091104752");
  });
  it("bir kaynak düşse diğeri döner; boş sorgu istek atmaz", async () => {
    const f = F(async (u) => { if (u.includes("beauty")) throw new Error("x"); return resp([off("3017620422003", "Nutella", "Ferrero")]); });
    expect((await searchProducts("nutella", "baby", f)).map((c) => c.barcode)).toContain("3017620422003");
    const g = F(async () => resp([]));
    expect(await searchProducts("  ", "baby", g)).toEqual([]);
    expect(g).not.toHaveBeenCalled();
  });
});

describe("uzun sorgu gevşetme", () => {
  it("4 kelimelik sorgu boşsa ilk 2 kelimeyle tekrar dener", async () => {
    const f = F(async (u) => {
      const terms = decodeURIComponent(new URL(u).searchParams.get("search_terms") ?? "").split(" ").length;
      return resp(terms <= 2 ? [off("8690000000099", "Sarelle Kakaolu Fındık Kreması", "Sarelle")] : []);
    });
    const r = await searchProducts("Sarelle Kakaolu Fındık Ezmesi", "food", f);
    expect(r.map((c) => c.barcode)).toContain("8690000000099");
    expect((f as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(4); // 2 kaynak x 2 deneme
  });
  it("kısa sorguda tekrar denemez", async () => {
    const f = F(async () => resp([]));
    await searchProducts("sarelle ezme", "food", f);
    expect((f as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(2);
  });
});

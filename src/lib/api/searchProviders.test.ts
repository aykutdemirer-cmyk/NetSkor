import { beforeEach, describe, expect, it, vi } from "vitest";
import { configuredProviders, searchWeb, _resetProviders } from "./searchProviders";
import { searchReviews } from "./reviewSearch";
import { webLookupProduct } from "./webLookup";

beforeEach(() => _resetProviders());

const ok = (body: object) => new Response(JSON.stringify(body));
const serpapiBody = { organic_results: [{ title: "SerpAPI sonucu", link: "https://www.trendyol.com/a", snippet: "uygun fiyat 120 TL" }] };
const serperBody = { organic: [{ title: "Serper sonucu", link: "https://www.hepsiburada.com/b", snippet: "güzel koku" }] };
const braveBody = { web: { results: [{ title: "Brave sonucu", url: "https://www.amazon.com.tr/c", description: "<strong>etkili</strong> ürün" }] } };

describe("configuredProviders", () => {
  it("sıra: serpapi, serper, brave, google; yalnızca tanımlılar", () => {
    expect(configuredProviders({})).toEqual([]);
    expect(configuredProviders({ BRAVE_SEARCH_API_KEY: "b", SERPAPI_KEY: "s", GOOGLE_SEARCH_API_KEY: "g" })).toEqual(["serpapi", "brave"]); // google CX olmadan eklenmez
    expect(configuredProviders({ SERPAPI_KEY: "s", SERPER_API_KEY: "x", BRAVE_SEARCH_API_KEY: "b", GOOGLE_SEARCH_API_KEY: "g", GOOGLE_SEARCH_CX: "c" })).toEqual(["serpapi", "serper", "brave", "google"]);
  });
});

describe("searchWeb yedek zinciri", () => {
  const env = { SERPAPI_KEY: "s", SERPER_API_KEY: "x", BRAVE_SEARCH_API_KEY: "b" };
  const route = (u: string) => (u.includes("serpapi") ? "serpapi" : u.includes("serper") ? "serper" : "brave");

  it("SerpAPI kotası (429) bitince Serper'e geçer; sonraki isteklerde SerpAPI atlanır", async () => {
    const f = vi.fn(async (u: string) => (route(u) === "serpapi" ? new Response("", { status: 429 }) : ok(serperBody))) as unknown as typeof fetch;
    const r1 = await searchWeb("q", env, f);
    expect(r1?.provider).toBe("serper");
    expect(r1?.hits[0].title).toBe("Serper sonucu");
    const before = (f as unknown as { mock: { calls: string[][] } }).mock.calls.filter((c) => c[0].includes("serpapi")).length;
    await searchWeb("q2", env, f);
    const after = (f as unknown as { mock: { calls: string[][] } }).mock.calls.filter((c) => c[0].includes("serpapi")).length;
    expect(after).toBe(before); // cooldown: tekrar denenmedi
  });

  it("ağ hatası: cooldown olmadan sıradakine geçer; Brave HTML etiketlerini temizler", async () => {
    const f = vi.fn(async (u: string) => { if (route(u) === "brave") return ok(braveBody); throw new Error("net"); }) as unknown as typeof fetch;
    const r = await searchWeb("q", env, f);
    expect(r?.provider).toBe("brave");
    expect(r?.hits[0]).toMatchObject({ snippet: "etkili ürün", link: "https://www.amazon.com.tr/c" });
  });

  it("hepsi başarısız veya anahtar yok -> null", async () => {
    const f = vi.fn(async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    expect(await searchWeb("q", env, f)).toBeNull();
    expect(await searchWeb("q", {}, f)).toBeNull();
  });
});

describe("entegrasyon", () => {
  it("searchReviews: SerpAPI düşünce Serper ile canlı sonuç", async () => {
    const f = vi.fn(async (u: string) => (u.includes("serpapi") ? new Response("", { status: 429 }) : ok(serperBody))) as unknown as typeof fetch;
    const r = await searchReviews({ productName: "Krem", brand: "M", category: "baby" }, "1", f, { SERPAPI_KEY: "s", SERPER_API_KEY: "x" });
    expect(r.mode).toBe("live");
    expect(r.reviews[0].source).toBe("hepsiburada");
  });
  it("searchReviews: tüm sağlayıcılar düşerse demo", async () => {
    const f = vi.fn(async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    expect((await searchReviews({ productName: "Krem", brand: "M", category: "baby" }, "1", f, { SERPAPI_KEY: "s", SERPER_API_KEY: "x" })).mode).toBe("demo");
  });
  it("webLookup: SerpAPI yoksa Brave ile ürün adı ve fiyat bulunur", async () => {
    const f = vi.fn(async (u: string) => ok(u.includes("brave")
      ? { web: { results: [
          { title: "Sarelle Kakaolu Fındık Ezmesi 350 g - Migros", url: "https://migros.com.tr/a", description: "120 TL. İçindekiler: Şeker, palm yağı, fındık, kakao, emülgatör." },
          { title: "Sarelle Kakaolu Fındık Ezmesi 350g | A101", url: "https://a101.com.tr/b", description: "115 TL" },
          { title: "Sarelle Fındık Ezmesi Kakaolu 350 g", url: "https://x.com/c", description: "" },
        ] } }
      : {})) as unknown as typeof fetch;
    const r = await webLookupProduct("8690000000099", "food", f, { BRAVE_SEARCH_API_KEY: "b" });
    expect(r?.name).toContain("Sarelle");
    expect(r?.prices).toEqual([120, 115]);
    expect(r?.ingredientsText).toContain("palm yağı");
  });
});

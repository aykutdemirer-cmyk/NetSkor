import { beforeEach, describe, expect, it, vi } from "vitest";
import { _clearMemoryCache, cacheGet, cacheSet, isPersistent } from "./cache";
import { getContribution, saveContribution, validateContribution } from "./contrib";
import { enrichProduct } from "./api/enrichProduct";
import { getConfidence } from "./confidence";
import { MOCK_PRODUCTS } from "@/data/mockProducts";
import { mapToAnalysis } from "./api/mapToAnalysis";

beforeEach(() => _clearMemoryCache());

describe("cache", () => {
  it("bellek: yaz/oku, TTL dolunca silinir", async () => {
    vi.useFakeTimers();
    await cacheSet("k", { a: 1 }, 10, {});
    expect(await cacheGet("k", {})).toEqual({ a: 1 });
    vi.advanceTimersByTime(11_000);
    expect(await cacheGet("k", {})).toBeNull();
    vi.useRealTimers();
  });
  it("Upstash REST: komut gövdesi ve yetkilendirme; hata olursa null", async () => {
    const env = { KV_REST_API_URL: "https://r.example", KV_REST_API_TOKEN: "t" };
    expect(isPersistent(env)).toBe(true);
    const f = vi.fn(async () => new Response(JSON.stringify({ result: JSON.stringify({ x: 1 }) })));
    expect(await cacheGet("a", env, f as unknown as typeof fetch)).toEqual({ x: 1 });
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual(["GET", "a"]);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t");
    await cacheSet("a", { y: 2 }, 60, env, f as unknown as typeof fetch);
    expect(JSON.parse((f.mock.calls[1] as unknown as [string, RequestInit])[1].body as string)).toEqual(["SET", "a", '{"y":2}', "EX", 60]);
    const bad = vi.fn(async () => { throw new Error("net"); });
    expect(await cacheGet("a", env, bad as unknown as typeof fetch)).toBeNull();
  });
});

describe("katkı", () => {
  const ok = { barcode: "8690000000123", name: "Test Krem", brand: "M", category: "baby", ingredients: "Aqua, Parfum" };
  it("doğrulama", () => {
    expect(validateContribution(ok).ok).toBe(true);
    expect(validateContribution({ ...ok, barcode: "12" }).ok).toBe(false);
    expect(validateContribution({ ...ok, category: "x" }).ok).toBe(false);
    expect(validateContribution({ ...ok, website: "http://spam" }).ok).toBe(false); // honeypot
    const v = validateContribution({ ...ok, name: "<b>Krem</b>\n" });
    expect(v.ok && v.value.name).toBe("b Krem /b");
  });
  it("kalıcı depolama yoksa kaydetmez; varsa kaydeder ve analiz hattında kullanılır", async () => {
    expect(await saveContribution(ok as never, {})).toBe(false);
    const store = new Map<string, string>();
    const env = { KV_REST_API_URL: "https://r.example", KV_REST_API_TOKEN: "t" };
    const f = vi.fn(async (_u: string, init: RequestInit) => {
      const [cmd, k, v] = JSON.parse(init.body as string);
      if (cmd === "SET") { store.set(k, v); return new Response(JSON.stringify({ result: "OK" })); }
      return new Response(JSON.stringify({ result: store.get(k) ?? null }));
    }) as unknown as typeof fetch;
    expect(await saveContribution(ok as never, env, f)).toBe(true);
    expect((await getContribution("8690000000123", env, f))?.source).toBe("user");
    const r = await enrichProduct("8690000000123", "food", f, env);
    expect(r).toMatchObject({ productSource: "user", product: { category: "baby" } });
    expect(r?.cons.join(" ")).toContain("Parfüm");
  });
});

describe("enrichProduct önbellek", () => {
  it("ikinci çağrıda ağ isteği yapılmaz; demo sonuç saklanmaz", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ status: 1, product: { code: "9990000000777", product_name: "X Krem", brands: "Y", ingredients_text: "Aqua" } }))) as unknown as typeof fetch;
    const a = await enrichProduct("9990000000777", "baby", f, {}); // anahtar yok -> demo yorum
    expect(a?.reviewMode).toBe("demo");
    const calls = (f as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    await enrichProduct("9990000000777", "baby", f, {});
    expect((f as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBeGreaterThan(calls); // demo saklanmadığı için tekrar sorgular
  });
  it("canlı sonuç saklanır", async () => {
    const f = vi.fn(async (u: string) => u.includes("serpapi")
      ? new Response(JSON.stringify({ organic_results: [{ title: "t", link: "https://www.trendyol.com/p", snippet: "Güzel koku, uygun fiyat, çok memnun kaldım. Fiyat : 120 TL" }] }))
      : new Response(JSON.stringify({ status: 1, product: { code: "9990000000778", product_name: "Z Krem", brands: "Y", ingredients_text: "Aqua", quantity: "100 ml" } }))) as unknown as typeof fetch;
    const env = { SERPAPI_KEY: "k" };
    await enrichProduct("9990000000778", "baby", f, env);
    const n = (f as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    await enrichProduct("9990000000778", "baby", f, env);
    expect((f as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(n);
  });
});

describe("güven etiketleri", () => {
  it("mock: içerik kaynaklı, yorum/fiyat örnek; skor gösterilir", () => {
    expect(getConfidence(MOCK_PRODUCTS["5011091104752"])).toEqual({ ingredients: "high", reviews: "sample", price: "sample", showScore: true, experience: false });
  });
  it("içerik yoksa skor gösterilmez; web kaynağı doğrulanmamış", () => {
    const none = mapToAnalysis({ barcode: "1", name: "X", brand: "", analysisTags: [], source: "openbeautyfacts" }, "baby");
    expect(getConfidence(none).showScore).toBe(false);
    const web = mapToAnalysis({ barcode: "1", name: "X", brand: "", ingredientsText: "Aqua", analysisTags: [], source: "web" }, "baby");
    expect(getConfidence(web)).toMatchObject({ ingredients: "medium", showScore: true });
  });
});

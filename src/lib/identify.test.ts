import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidEan } from "./ean";
import { identifyImage } from "./identify";
import { allow } from "./rateLimit";
import { _clearMemoryCache } from "./cache";

beforeEach(() => _clearMemoryCache());

describe("isValidEan", () => {
  it("geçerli EAN-13 / EAN-8 / UPC-A", () => {
    for (const c of ["3017620422003", "3504105035600", "8690536821129", "96385074", "036000291452"]) expect(isValidEan(c)).toBe(true);
  });
  it("yanlış sağlama toplamı, uzunluk ve harf reddedilir", () => {
    for (const c of ["3017620422004", "8690536821128", "12345", "abcdefghijklm", "", "30176204220031"]) expect(isValidEan(c)).toBe(false);
  });
});

const fake = (parsed: object | null, stop_reason = "end_turn") => ({ messages: { parse: vi.fn(async () => ({ stop_reason, parsed_output: parsed })) } }) as never;

describe("identifyImage", () => {
  it("geçerli barkodu ve 'marka ad' sorgusunu döner", async () => {
    const r = await identifyImage("AAAA", "image/jpeg", { client: fake({ barcode: "8690536821129", brand: "Molfix", name: "Bebek Bezi Mini 36'lı", category: "baby", confidence: "high" }) });
    expect(r).toEqual({ barcode: "8690536821129", query: "Molfix Bebek Bezi Mini 36'lı", category: "baby", confidence: "high" });
  });
  it("modelin uydurduğu (sağlaması tutmayan) barkod atılır, sorgu kalır", async () => {
    const r = await identifyImage("AAAA", "image/jpeg", { client: fake({ barcode: "8690536821120", brand: "Molfix", name: "Bez", category: null, confidence: "medium" }) });
    expect(r?.barcode).toBeUndefined();
    expect(r?.query).toBe("Molfix Bez");
  });
  it("hiçbir şey okunamazsa, ret ya da çözümlenemeyen yanıtta null", async () => {
    expect(await identifyImage("A", "image/png", { client: fake({ barcode: null, brand: null, name: null, category: null, confidence: "low" }) })).toBeNull();
    expect(await identifyImage("A", "image/png", { client: fake(null) })).toBeNull();
    expect(await identifyImage("A", "image/png", { client: fake({ barcode: null, brand: "X", name: "Y", category: null, confidence: "high" }, "refusal") })).toBeNull();
  });
  it("görsel, düşük eforla ve şema ile gönderilir", async () => {
    const client = fake({ barcode: null, brand: "X", name: "Y", category: null, confidence: "low" });
    await identifyImage("QUJD", "image/webp", { client, model: "claude-test" });
    const args = (client as unknown as { messages: { parse: { mock: { calls: [Record<string, any>][] } } } }).messages.parse.mock.calls[0][0];
    expect(args.model).toBe("claude-test");
    expect(args.messages[0].content[0]).toEqual({ type: "image", source: { type: "base64", media_type: "image/webp", data: "QUJD" } });
    expect(args.output_config.effort).toBe("low");
    expect(args.output_config.format).toBeTruthy();
  });
});

describe("allow (istek sınırı)", () => {
  it("limite kadar izin verir, sonra reddeder", async () => {
    expect([await allow("k", 2, 60), await allow("k", 2, 60), await allow("k", 2, 60)]).toEqual([true, true, false]);
    expect(await allow("other", 2, 60)).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _clearMemoryCache } from "@/lib/cache";

vi.mock("@/lib/identify", () => ({ identifyImage: vi.fn(async () => ({ barcode: "8690536821129", query: "Molfix Bebek Bezi", confidence: "high" })) }));
import { POST } from "./route";
import { identifyImage } from "@/lib/identify";

const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://netskor.test/api/identify", { method: "POST", headers: { "content-type": "application/json", host: "netskor.test", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const ok = { image: "data:image/jpeg;base64,QUJDRA==", mediaType: "image/jpeg" };

beforeEach(() => { _clearMemoryCache(); vi.stubEnv("ANTHROPIC_API_KEY", "test-key"); });
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/identify", () => {
  it("anahtar yoksa 501 (özellik kapalı)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect((await POST(req(ok))).status).toBe(501);
  });
  it("geçerli istek: data URL öneki temizlenip model çağrılır", async () => {
    const res = await POST(req(ok));
    expect(res.status).toBe(200);
    expect((await res.json()).result.barcode).toBe("8690536821129");
    expect(identifyImage).toHaveBeenCalledWith("QUJDRA==", "image/jpeg");
  });
  it("bozuk gövde, bilinmeyen tür, büyük ve geçersiz karakterli veri 400", async () => {
    expect((await POST(req("{bozuk"))).status).toBe(400);
    expect((await POST(req({ ...ok, mediaType: "application/pdf" }))).status).toBe(400);
    expect((await POST(req({ image: "A".repeat(3_600_000), mediaType: "image/png" }))).status).toBe(400);
    expect((await POST(req({ image: "<script>", mediaType: "image/png" }))).status).toBe(400);
  });
  it("başka siteden gelen istek 403", async () => {
    expect((await POST(req(ok, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await POST(req(ok, { origin: "https://netskor.test" }))).status).toBe(200);
  });
  it("IP başına saatte 15 istek; 16. istek 429", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 16; i++) codes.push((await POST(req(ok, { "x-forwarded-for": "1.2.3.4" }))).status);
    expect(codes.slice(0, 15).every((c) => c === 200)).toBe(true);
    expect(codes[15]).toBe(429);
    expect((await POST(req(ok, { "x-forwarded-for": "5.6.7.8" }))).status).toBe(200); // başka IP etkilenmez
  });
  it("model hatasında 502", async () => {
    vi.mocked(identifyImage).mockRejectedValueOnce(new Error("boom"));
    expect((await POST(req(ok, { "x-forwarded-for": "9.9.9.9" }))).status).toBe(502);
  });
});

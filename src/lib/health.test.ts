import { describe, expect, it, vi } from "vitest";
import { checkHealth } from "./health";

const F = (impl: (u: string) => Promise<Response>) => vi.fn(impl) as unknown as typeof fetch;

describe("checkHealth", () => {
  it("iki kaynak ayakta -> ok; arama yapılandırması env'den", async () => {
    const r = await checkHealth(F(async () => new Response("{}")), { SERPAPI_KEY: "k" });
    expect(r).toMatchObject({ status: "ok", checks: { openfoodfacts: true, openbeautyfacts: true, search: "serpapi" } });
  });
  it("biri düşerse hâlâ ok; ikisi düşerse degraded (çökmez)", async () => {
    const half = await checkHealth(F(async (u) => { if (u.includes("beauty")) throw new Error("x"); return new Response("{}"); }), {});
    expect(half.status).toBe("ok");
    expect(half.checks).toMatchObject({ openbeautyfacts: false, search: "demo" });
    const down = await checkHealth(F(async () => new Response("", { status: 503 })), { GOOGLE_SEARCH_API_KEY: "a", GOOGLE_SEARCH_CX: "b" });
    expect(down).toMatchObject({ status: "degraded", checks: { search: "google" } });
  });
});

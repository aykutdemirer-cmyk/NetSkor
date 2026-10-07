import { describe, expect, it } from "vitest";
import { compareProducts } from "./compare";
import { MOCK_PRODUCTS as M } from "@/data/mockProducts";

describe("compareProducts", () => {
  it("Mustela, Dalin'e karşı önde; ağırlıklar 1.0", () => {
    const r = compareProducts(M["8690605061158"], M["3504105035600"]);
    expect(r.criteria.reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1);
    expect(r.winner).toBe("b");
    expect(r.verdict.some((v) => v.includes("Fiyat") && v.includes("Dalin"))).toBe(true);
  });
});

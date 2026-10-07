import { describe, expect, it } from "vitest";
import { bandOf, calculateScore, starsToScore } from "./scoring";

describe("scoring", () => {
  it("ağırlıklar her kategoride 1.0 toplar", () => {
    for (const c of ["baby", "cosmetics", "food", "cleaning"] as const) {
      const r = calculateScore(c, { ingredientSafety: 100, reviewSatisfaction: 100, certification: 100, valueForMoney: 100 });
      expect(r.total).toBe(100);
    }
  });
  it("bebek: şikayet oranı yorum puanını düşürür", () => {
    const base = { ingredientSafety: 90, reviewSatisfaction: 90, certification: 80, valueForMoney: 70 };
    const a = calculateScore("baby", { ...base, complaintRate: 0 });
    const b = calculateScore("baby", { ...base, complaintRate: 0.3 });
    expect(a.total).toBe(87); // 36+31.5+12+7 = 86.5 -> 87
    expect(b.total).toBeLessThan(a.total);
  });
  it("bantlar", () => {
    expect(bandOf(90)).toBe("green");
    expect(bandOf(89)).toBe("amber");
    expect(bandOf(69)).toBe("red");
    expect(starsToScore(5)).toBe(100);
  });
});

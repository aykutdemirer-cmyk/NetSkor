import { calculateScore } from "@/lib/scoring";
import type { ProductAnalysis } from "@/types";

export interface Criterion { key: string; label: string; weight: number; a: number; b: number }
export interface Comparison { criteria: Criterion[]; totalA: number; totalB: number; winner: "a" | "b" | "tie"; verdict: string[] }

// Bebek kategorisi ağırlıkları (toplam 1.0)
const CRITERIA: { key: string; label: string; weight: number; pick: (d: ProductAnalysis) => number }[] = [
  { key: "natural", label: "Doğallık", weight: 0.3, pick: (d) => d.inputs.certification ?? d.inputs.ingredientSafety },
  { key: "skin", label: "Cilt Uyumu", weight: 0.3, pick: (d) => Math.round(d.inputs.reviewSatisfaction * (1 - (d.inputs.complaintRate ?? 0))) },
  { key: "sting", label: "Göz Yakmama", weight: 0.2, pick: (d) => d.noSting },
  { key: "price", label: "Fiyat", weight: 0.2, pick: (d) => d.inputs.valueForMoney },
];

export function compareProducts(A: ProductAnalysis, B: ProductAnalysis): Comparison {
  const criteria = CRITERIA.map((c) => ({ key: c.key, label: c.label, weight: c.weight, a: c.pick(A), b: c.pick(B) }));
  const sum = (k: "a" | "b") => Math.round(criteria.reduce((s, c) => s + c[k] * c.weight, 0));
  const totalA = sum("a"), totalB = sum("b");
  const winner = Math.abs(totalA - totalB) < 2 ? "tie" : totalA > totalB ? "a" : "b";

  // Her kriterde farkı >= 10 olan taraf için "ne zaman tercih edilir" cümlesi üret
  const verdict: string[] = [];
  const nameA = A.product.brand, nameB = B.product.brand;
  for (const c of criteria) {
    if (Math.abs(c.a - c.b) >= 10) verdict.push(`${c.label} öncelikliyse ${c.a > c.b ? nameA : nameB} tercih edin (${Math.max(c.a, c.b)} vs ${Math.min(c.a, c.b)}).`);
  }
  const sa = calculateScore(A.product.category, A.inputs).total, sb = calculateScore(B.product.category, B.inputs).total;
  verdict.unshift(
    winner === "tie" ? "İki ürün genel olarak başa baş." : `Genel olarak ${winner === "a" ? nameA : nameB} önde (kriter skoru ${Math.max(totalA, totalB)} vs ${Math.min(totalA, totalB)}; NetSkor ${sa} vs ${sb}).`,
  );
  return { criteria, totalA, totalB, winner, verdict };
}

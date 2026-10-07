import { calculateScore } from "@/lib/scoring";
import type { ProductAnalysis } from "@/types";

export interface Criterion { key: string; label: string; weight: number; a: number; b: number }
export interface Comparison {
  criteria: Criterion[];
  totalA: number;
  totalB: number;
  winner: "a" | "b" | "tie";
  mixedCategories: boolean;
  verdict: string[];
}

const reviewAdjusted = (d: ProductAnalysis) => Math.round(d.inputs.reviewSatisfaction * (1 - (d.inputs.complaintRate ?? 0)));

// Bebek VS tablosu (toplam 1.0); diğer kategoriler skor motorunun ağırlıklarını kullanır
const BABY = [
  { key: "natural", label: "Doğallık", weight: 0.3, pick: (d: ProductAnalysis) => d.inputs.certification ?? d.inputs.ingredientSafety },
  { key: "skin", label: "Cilt Uyumu", weight: 0.3, pick: reviewAdjusted },
  { key: "sting", label: "Göz Yakmama", weight: 0.2, pick: (d: ProductAnalysis) => d.noSting },
  { key: "price", label: "Fiyat", weight: 0.2, pick: (d: ProductAnalysis) => d.inputs.valueForMoney },
];

function buildCriteria(A: ProductAnalysis, B: ProductAnalysis, mixed: boolean): Criterion[] {
  const cat = A.product.category;
  if (!mixed && cat === "baby") return BABY.map((c) => ({ key: c.key, label: c.label, weight: c.weight, a: c.pick(A), b: c.pick(B) }));
  // Farklı kategorilerde ortak 40/35/25 seti (içerik / yorum / fiyat) adil kıyas sağlar
  const base = mixed ? "cleaning" : cat;
  const pa = calculateScore(base, A.inputs).parts, pb = calculateScore(base, B.inputs).parts;
  return pa.map((p, i) => ({ key: p.key, label: p.label, weight: p.weight, a: p.score, b: pb[i].score }));
}

const isApprox = (d: ProductAnalysis) => d.reviewMode === "demo" || !!d.estimated?.reviews || !!d.estimated?.value || !!d.estimated?.ingredients;

export function compareProducts(A: ProductAnalysis, B: ProductAnalysis): Comparison {
  const mixed = A.product.category !== B.product.category;
  const criteria = buildCriteria(A, B, mixed);
  const sum = (k: "a" | "b") => Math.round(criteria.reduce((s, c) => s + c[k] * c.weight, 0));
  const totalA = sum("a"), totalB = sum("b");
  const winner = Math.abs(totalA - totalB) < 2 ? "tie" : totalA > totalB ? "a" : "b";
  const nameA = A.product.brand, nameB = B.product.brand;

  const verdict: string[] = [];
  const sa = calculateScore(A.product.category, A.inputs).total, sb = calculateScore(B.product.category, B.inputs).total;
  verdict.push(
    winner === "tie"
      ? "İki ürün genel olarak başa baş."
      : `Genel olarak ${winner === "a" ? nameA : nameB} önde (kriter skoru ${Math.max(totalA, totalB)} vs ${Math.min(totalA, totalB)}; NetSkor ${sa} vs ${sb}).`,
  );
  // Farkı >= 10 olan her kriter için "ne zaman tercih edilir"
  for (const c of criteria)
    if (Math.abs(c.a - c.b) >= 10) verdict.push(`${c.label} öncelikliyse ${c.a > c.b ? nameA : nameB} tercih edin (${Math.max(c.a, c.b)} vs ${Math.min(c.a, c.b)}).`);
  const ca = A.inputs.complaintRate ?? 0, cb = B.inputs.complaintRate ?? 0;
  if (Math.abs(ca - cb) >= 0.15) verdict.push(`${ca < cb ? nameA : nameB} ürününde şikayet oranı belirgin daha düşük (%${Math.round(Math.min(ca, cb) * 100)} vs %${Math.round(Math.max(ca, cb) * 100)}).`);
  if (mixed) verdict.push("Ürünler farklı kategorilerde; ortak içerik/yorum/fiyat ağırlıklarıyla kıyaslandı.");
  if (isApprox(A) || isApprox(B)) verdict.push("Not: en az bir üründe demo veya tahmini veri var; kesin karar için gerçek yorum verisi gerekir.");
  return { criteria, totalA, totalB, winner, mixedCategories: mixed, verdict };
}

import type { ProductAnalysis } from "@/types";

export type Level = "high" | "claim" | "medium" | "low" | "sample" | "none";

export interface Confidence {
  ingredients: Level;
  reviews: Level;
  price: Level;
  showScore: boolean; // içerik verisi yoksa sayısal skor gösterilmez
  experience: boolean; // içerik yok ama yorum ve fiyat var: kullanıcı deneyimi ağırlıklı skor gösterilir
}

export const LEVEL_LABEL: Record<Level, string> = {
  high: "Kaynaklı veri",
  claim: "Üretici beyanı",
  medium: "Doğrulanmamış",
  low: "Arama özeti",
  sample: "Örnek veri",
  none: "Veri yok",
};

export const LEVEL_STYLE: Record<Level, string> = {
  high: "bg-green-500/15 text-green-300",
  claim: "bg-violet-500/15 text-violet-300",
  medium: "bg-sky-500/15 text-sky-300",
  low: "bg-amber-500/15 text-amber-300",
  sample: "bg-slate-500/20 text-slate-300",
  none: "bg-slate-700/40 text-slate-400",
};

export function getConfidence(d: ProductAnalysis): Confidence {
  const mock = !d.reviewMode && !d.productSource; // elle yazılmış demo ürünler
  const demo = d.reviewMode === "demo" || mock;

  const ingredients: Level = d.estimated?.ingredients ? "none" : d.contentBasis === "claims" ? "claim" : d.productSource === "web" || d.productSource === "user" ? "medium" : "high";
  const reviews: Level = d.estimated?.reviews ? "none" : demo ? "sample" : "low";
  const price: Level = d.estimated?.value ? "none" : demo ? "sample" : "low";
  return { ingredients, reviews, price, showScore: ingredients !== "none", experience: ingredients === "none" && reviews !== "none" && price !== "none" };
}

import type { Category } from "@/types";

export interface RiskRule { id: string; label: string; pattern: RegExp; penalty: number }
export interface IngredientAnalysis { ingredientScore: number; risks: RiskRule[]; analyzed: boolean }

const COSMETIC: RiskRule[] = [
  { id: "paraben", label: "Paraben", pattern: /paraben/i, penalty: 20 },
  { id: "phenoxyethanol", label: "Fenoksietanol", pattern: /ph?enoxyethanol|fenoksietanol/i, penalty: 15 },
  { id: "sls", label: "SLS / SLES", pattern: /\bsodium (laureth|lauryl) sulf?ate\b|\bsl?es\b/i, penalty: 20 },
  { id: "bht", label: "BHT", pattern: /\bbht\b|butylated hydroxytoluene/i, penalty: 10 },
  { id: "fragrance", label: "Parfüm / Koku", pattern: /\bparfum\b|fragrance|\bkoku\b|aroma/i, penalty: 15 },
  { id: "alcohol", label: "Alkol (Denat.)", pattern: /alcohol denat|denatured alcohol/i, penalty: 10 },
];

const FOOD: RiskRule[] = [
  { id: "palm", label: "Palm yağı", pattern: /palm (oil|yağı|kernel)|palmiye/i, penalty: 20 },
  { id: "glucose", label: "Glukoz/Fruktoz şurubu", pattern: /gluko?z (fruktoz )?şurubu|glucose(-fructose)? syrup|fructose syrup/i, penalty: 15 },
  { id: "aspartame", label: "Aspartam", pattern: /aspart(am|ame)/i, penalty: 20 },
  { id: "ecode", label: "E kodlu katkı", pattern: /\be-?\d{3}[a-i]?\b/i, penalty: 10 },
  { id: "colorant", label: "Yapay renklendirici", pattern: /colou?rant|renklendirici/i, penalty: 10 },
];

// Temizlik ürünleri kozmetik kural setini paylaşır
const RULES: Record<Category, RiskRule[]> = { baby: COSMETIC, cosmetics: COSMETIC, cleaning: COSMETIC, food: FOOD };

/** Ham içerik metnini tarar; her riskli bileşen kendi cezasını düşer (tekrar saymaz). */
export function analyzeIngredients(category: Category, text: string | undefined, extraTags: string[] = []): IngredientAnalysis {
  const hay = [text ?? "", ...extraTags].join(" , ");
  if (!hay.replace(/[ ,]/g, "")) return { ingredientScore: 0, risks: [], analyzed: false };
  const risks = RULES[category].filter((r) => r.pattern.test(hay));
  const penalty = risks.reduce((s, r) => s + r.penalty, 0);
  return { ingredientScore: Math.max(0, 100 - penalty), risks, analyzed: true };
}

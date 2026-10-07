import { analyzeIngredients } from "@/lib/scoring/ingredientAnalyzer";
import type { Category, ProductAnalysis } from "@/types";
import type { LookupResult } from "./productLookup";

const NUTRI_SCORE: Record<string, number> = { a: 100, b: 85, c: 65, d: 45, e: 25 };
const CAT_EMOJI: Record<Category, string> = { baby: "👶", cosmetics: "🧴", food: "🍪", cleaning: "🧼" };
const NEUTRAL = 70; // veri yoksa nötr değer; arayüzde "tahmini" olarak işaretlenir

export function mapToAnalysis(r: LookupResult, category: Category): ProductAnalysis {
  const a = analyzeIngredients(category, r.ingredientsText, r.analysisTags);
  const nutri = r.nutriscore ? NUTRI_SCORE[r.nutriscore.toLowerCase()] : undefined;
  // Gıdada Nutri-Score içerik skoruyla harmanlanır
  const ingredientSafety = !a.analyzed ? NEUTRAL : nutri !== undefined && category === "food" ? Math.round((a.ingredientScore + nutri) / 2) : a.ingredientScore;

  return {
    product: {
      barcode: r.barcode, name: r.name, brand: r.brand || "Bilinmeyen Marka", category, imageUrl: r.imageUrl,
      ingredients: (r.ingredientsText ?? "").split(/[,;]/).map((s) => s.trim()).filter(Boolean),
      priceTry: 0, netAmount: 0, unit: category === "food" ? "g" : "ml",
    },
    emoji: CAT_EMOJI[category],
    ageGroup: r.quantity ?? "—",
    audience: ["Genel kullanım"],
    pros: a.analyzed && a.risks.length === 0 ? ["Taranan riskli içerik bulunmadı"] : nutri !== undefined && nutri >= 85 ? [`Nutri-Score ${r.nutriscore!.toUpperCase()}`] : [],
    cons: a.risks.map((x) => `${x.label} içeriyor`),
    noSting: NEUTRAL,
    inputs: { ingredientSafety, reviewSatisfaction: NEUTRAL, complaintRate: 0, certification: NEUTRAL, valueForMoney: NEUTRAL },
    reviews: [],
    estimated: { reviews: true, value: true, ingredients: !a.analyzed },
  };
}

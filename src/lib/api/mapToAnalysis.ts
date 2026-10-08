import { claimScore, isNonInci, scanClaims } from "@/lib/scoring/claimScanner";
import { analyzeIngredients } from "@/lib/scoring/ingredientAnalyzer";
import type { Category, ProductAnalysis } from "@/types";
import type { LookupResult } from "./productLookup";

const NUTRI_SCORE: Record<string, number> = { a: 100, b: 85, c: 65, d: 45, e: 25 };
const CAT_EMOJI: Record<Category, string> = { baby: "👶", cosmetics: "🧴", food: "🍪", cleaning: "🧼" };
const NEUTRAL = 70; // veri yoksa nötr değer; arayüzde "tahmini" olarak işaretlenir

export function mapToAnalysis(r: LookupResult, category: Category): ProductAnalysis {
  const a = analyzeIngredients(category, r.ingredientsText, r.analysisTags);
  // Bebek bezi / ıslak mendil gibi INCI listesi olmayan ürünlerde başlık ve açıklamadaki beyanlar taranır
  const claims = !a.analyzed && isNonInci(r.name) ? scanClaims(`${r.name} ${r.description ?? ""}`) : [];
  const nutri = r.nutriscore ? NUTRI_SCORE[r.nutriscore.toLowerCase()] : undefined;
  // Gıdada Nutri-Score içerik skoruyla harmanlanır
  const ingredientSafety = claims.length > 0 ? claimScore(claims.length) : !a.analyzed ? NEUTRAL : nutri !== undefined && category === "food" ? Math.round((a.ingredientScore + nutri) / 2) : a.ingredientScore;

  return {
    product: {
      barcode: r.barcode, name: r.name, brand: r.brand || "Bilinmeyen Marka", category, imageUrl: r.imageUrl,
      ingredients: (r.ingredientsText ?? "").split(/[,;]/).map((s) => s.trim()).filter(Boolean),
      priceTry: 0, netAmount: 0, unit: category === "food" ? "g" : "ml",
    },
    emoji: CAT_EMOJI[category],
    ageGroup: r.quantity ?? "—",
    audience: ["Genel kullanım"],
    claims,
    contentBasis: claims.length > 0 ? "claims" : "inci",
    pros: claims.length > 0 ? claims.map((c) => `${c} (üretici beyanı)`) : a.analyzed && a.risks.length === 0 ? ["Taranan riskli içerik bulunmadı"] : nutri !== undefined && nutri >= 85 ? [`Nutri-Score ${r.nutriscore!.toUpperCase()}`] : [],
    cons: a.risks.map((x) => `${x.label} içeriyor`),
    noSting: NEUTRAL,
    inputs: { ingredientSafety, reviewSatisfaction: NEUTRAL, complaintRate: 0, certification: NEUTRAL, valueForMoney: NEUTRAL },
    reviews: [],
    productSource: r.source === "web" ? "web" : r.source === "user" ? "user" : "openfacts",
    estimated: { reviews: true, value: true, ingredients: !a.analyzed && claims.length === 0 },
  };
}

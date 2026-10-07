import type { Category, ScoreBand, ScoreBreakdown, ScoreInputs } from "@/types";

type Part = { key: string; label: string; weight: number; pick: (i: ScoreInputs) => number };

// Ağırlıklar spesifikasyondaki tabloyla birebir; her kategori için toplam 1.0
const WEIGHTS: Record<Category, Part[]> = {
  baby: [
    { key: "ingredient", label: "İçerik Güvenliği", weight: 0.4, pick: (i) => i.ingredientSafety },
    { key: "reviews", label: "Ebeveyn Yorumları", weight: 0.35, pick: (i) => i.reviewSatisfaction * (1 - (i.complaintRate ?? 0)) },
    { key: "cert", label: "Pediatrik Onay & Doğallık", weight: 0.15, pick: (i) => i.certification ?? 0 },
    { key: "value", label: "Fiyat / Erişilebilirlik", weight: 0.1, pick: (i) => i.valueForMoney },
  ],
  cosmetics: [
    { key: "ingredient", label: "İçerik & Komedojenik", weight: 0.35, pick: (i) => i.ingredientSafety },
    { key: "reviews", label: "Memnuniyet & Etki", weight: 0.4, pick: (i) => i.reviewSatisfaction },
    { key: "value", label: "Fiyat / Performans", weight: 0.25, pick: (i) => i.valueForMoney },
  ],
  food: [
    { key: "reviews", label: "Lezzet & Beğeni", weight: 0.45, pick: (i) => i.reviewSatisfaction },
    { key: "ingredient", label: "İçerik Temizliği", weight: 0.3, pick: (i) => i.ingredientSafety },
    { key: "value", label: "Fiyat / Gramaj", weight: 0.25, pick: (i) => i.valueForMoney },
  ],
  // Spesifikasyonda tanımsız: kozmetik benzeri varsayılan (içerik ağırlıklı)
  cleaning: [
    { key: "ingredient", label: "İçerik Güvenliği", weight: 0.4, pick: (i) => i.ingredientSafety },
    { key: "reviews", label: "Kullanıcı Memnuniyeti", weight: 0.35, pick: (i) => i.reviewSatisfaction },
    { key: "value", label: "Fiyat / Performans", weight: 0.25, pick: (i) => i.valueForMoney },
  ],
};

const clamp = (n: number) => Math.min(100, Math.max(0, n));

export function bandOf(score: number): ScoreBand {
  if (score >= 90) return "green";
  if (score >= 70) return "amber";
  return "red";
}

/** 5 üzerinden ortalama yıldızı 0-100'e çevirir. */
export const starsToScore = (avg: number) => clamp(((avg - 1) / 4) * 100);

export function calculateScore(category: Category, inputs: ScoreInputs): ScoreBreakdown {
  const parts = WEIGHTS[category].map((p) => ({
    key: p.key,
    label: p.label,
    weight: p.weight,
    score: Math.round(clamp(p.pick(inputs))),
  }));
  const total = Math.round(parts.reduce((sum, p) => sum + p.score * p.weight, 0));
  return { total, band: bandOf(total), parts };
}

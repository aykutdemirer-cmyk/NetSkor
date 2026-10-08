import { RULES } from "@/lib/scoring/ingredientAnalyzer";
import { normTr } from "@/lib/text";
import type { Category, FeatureChecklist, InciHighlight } from "@/types";

const GOOD: { pattern: RegExp; note: string }[] = [
  { pattern: /zinc oxide|cinko oksit/, note: "Koruyucu bariyer" },
  { pattern: /glycerin|gliserin/, note: "Nem tutucu" },
  { pattern: /panthenol|pantenol/, note: "Onarıcı, yatıştırıcı" },
  { pattern: /allantoin/, note: "Yatıştırıcı" },
  { pattern: /aloe/, note: "Yatıştırıcı" },
  { pattern: /shea|karite/, note: "Besleyici" },
  { pattern: /coco-glucoside|decyl glucoside|lauryl glucoside/, note: "Yumuşak yüzey aktif" },
  { pattern: /persea|avocado|avokado/, note: "Besleyici bitkisel yağ" },
  { pattern: /squalane|skualan/, note: "Cilt bariyeri" },
  { pattern: /hyaluron/, note: "Nem tutucu" },
  { pattern: /bisabolol|chamomil|calendula|oat|avena/, note: "Yatıştırıcı bitki özü" },
];

/** İçerik listesindeki bileşenleri temiz/faydalı, dikkat edilmeli ve riskli olarak işaretler. */
export function buildHighlights(category: Category, ingredients: string[]): InciHighlight[] {
  const out: InciHighlight[] = [];
  const seen = new Set<string>();
  for (const raw of ingredients) {
    const name = raw.trim();
    const t = normTr(name);
    if (!name || seen.has(t)) continue;
    const risk = RULES[category].find((r) => r.pattern.test(name));
    const good = GOOD.find((g) => g.pattern.test(t));
    if (risk) out.push({ name, tone: risk.penalty >= 20 ? "risk" : "warn", note: risk.label });
    else if (good) out.push({ name, tone: "good", note: good.note });
    else continue;
    seen.add(t);
  }
  // Önce riskli, sonra dikkat, sonra faydalı
  const rank = { risk: 0, warn: 1, good: 2 } as const;
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 14);
}

const CERT = /hipoalerjenik|dermatolojik|pediatrik|klinik/i;

/** Sülfat/parfüm durumu: içerik listesinden; liste yoksa beyanlardan; ikisi de yoksa bilinmiyor (null). */
export function buildChecklist(category: Category, ingredientsText: string | undefined, claims: string[] = []): FeatureChecklist {
  const listed = !!ingredientsText && ingredientsText.trim().length > 0;
  const has = (id: string) => RULES[category].find((r) => r.id === id)?.pattern.test(ingredientsText ?? "") ?? false;
  const fragranceClaim = claims.includes("Parfümsüz");
  return {
    sulfateFree: listed ? !has("sls") : null,
    fragranceFree: listed ? !has("fragrance") : fragranceClaim ? true : null,
    naturalPct: null, // gerçek üründe ölçülemez
    certificates: claims.filter((c) => CERT.test(c)),
  };
}

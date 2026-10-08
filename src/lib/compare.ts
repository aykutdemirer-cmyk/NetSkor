import { calculateScore } from "@/lib/scoring";
import { annualUsage } from "@/lib/usage";
import { fmtTl } from "@/lib/scoring/priceEstimator";
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

// ---------- Zengin karşılaştırma: içerik kontrolü, maliyet, senaryolar ----------
export interface Check { text: string; ok: boolean | null } // ok: true ✓, false ✗, null bilinmiyor
export interface ContentRow { label: string; a: Check; b: Check }

const tri = (v: boolean | null | undefined): Check => (v == null ? { text: "—", ok: null } : v ? { text: "✓", ok: true } : { text: "✗", ok: false });

/** Yan yana madde kontrolü: sülfat, parfüm, doğallık yüzdesi, pediatrik/dermatolojik sertifikalar. */
export function contentChecks(A: ProductAnalysis, B: ProductAnalysis): ContentRow[] {
  const fa = A.featureChecklist, fb = B.featureChecklist;
  const natural = (f?: typeof fa): Check => (f?.naturalPct == null ? { text: "—", ok: null } : { text: `%${f.naturalPct}`, ok: f.naturalPct >= 70 });
  const certs = (f?: typeof fa): Check => (!f ? { text: "—", ok: null } : f.certificates.length ? { text: `✓ ${f.certificates.join(", ")}`, ok: true } : { text: "✗", ok: false });
  return [
    { label: "Sülfat içermez", a: tri(fa?.sulfateFree), b: tri(fb?.sulfateFree) },
    { label: "Parfümsüz", a: tri(fa?.fragranceFree), b: tri(fb?.fragranceFree) },
    { label: "Doğallık", a: natural(fa), b: natural(fb) },
    { label: "Pediatrik / dermatolojik sertifika", a: certs(fa), b: certs(fb) },
  ];
}

export interface CostSide { text: string; per100?: number; unit?: "ml" | "g" | "adet" }
export interface CostComparison {
  a: CostSide;
  b: CostSide;
  comparable: boolean; // aynı birimde (ml/g) mi
  cheaper?: "a" | "b";
  diffPct?: number; // ucuz olan, pahalıdan yüzde kaç daha ucuz
  yearly?: { a: number; b: number; diff: number; cheaper: "a" | "b"; assumption: string };
}

function side(d: ProductAnalysis): CostSide {
  const p = d.pricePerUnit;
  if (!p) return { text: "—" };
  if (p.unit === "adet") return { text: `${fmtTl(Math.round(p.value * 100) / 100)} TL / ${p.label ?? "adet"}`, unit: "adet" };
  const per100 = p.value * 100;
  return { text: `${fmtTl(Math.round(per100 * 100) / 100)} TL / 100 ${p.unit}`, per100, unit: p.unit };
}

export function costCompare(A: ProductAnalysis, B: ProductAnalysis): CostComparison {
  const a = side(A), b = side(B);
  const comparable = a.per100 != null && b.per100 != null && a.unit === b.unit;
  const out: CostComparison = { a, b, comparable };
  if (comparable) {
    const [lo, hi] = a.per100! <= b.per100! ? [a.per100!, b.per100!] : [b.per100!, a.per100!];
    out.cheaper = a.per100! <= b.per100! ? "a" : "b";
    out.diffPct = Math.round((1 - lo / hi) * 100);
  }
  // Yıllık tüketim farkı: yalnızca aynı tür ürünlerde ve birim uyuşuyorsa
  const ua = annualUsage(A.product.name), ub = annualUsage(B.product.name);
  if (comparable && A.pricePerUnit && B.pricePerUnit && ua && ub && ua.kind === ub.kind && ua.unit === A.pricePerUnit.unit && ub.unit === B.pricePerUnit.unit) {
    const ya = Math.round(A.pricePerUnit.value * ua.amount), yb = Math.round(B.pricePerUnit.value * ub.amount);
    out.yearly = { a: ya, b: yb, diff: Math.abs(ya - yb), cheaper: ya <= yb ? "a" : "b", assumption: ua.assumption };
  }
  return out;
}

export interface ScenarioPick { title: string; winner: "a" | "b" | "tie"; reasons: string[] }

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

/** İki hedef senaryo: hassas/yenidoğan cilt ve bütçe/günlük kullanım. Kural tabanlı, gerekçeli. */
export function scenarioPicks(A: ProductAnalysis, B: ProductAnalysis): ScenarioPick[] {
  const nameA = A.product.brand, nameB = B.product.brand;
  const bonus = (d: ProductAnalysis) => ((d.featureChecklist?.sulfateFree ? 50 : 0) + (d.featureChecklist?.fragranceFree ? 50 : 0));
  const sens = (d: ProductAnalysis) =>
    0.3 * (d.inputs.certification ?? d.inputs.ingredientSafety) + 0.25 * d.inputs.ingredientSafety + 0.2 * clampPct(100 - (d.inputs.complaintRate ?? 0) * 100) + 0.15 * d.noSting + 0.1 * bonus(d);

  const cost = costCompare(A, B);
  const unitScore = (own?: number, other?: number) => (own == null || other == null ? 50 : clampPct((Math.min(own, other) / own) * 100));
  const budget = (d: ProductAnalysis, side: "a" | "b") =>
    0.45 * d.inputs.valueForMoney + 0.35 * Math.round(d.inputs.reviewSatisfaction * (1 - (d.inputs.complaintRate ?? 0))) +
    0.2 * (cost.comparable ? unitScore(side === "a" ? cost.a.per100 : cost.b.per100, side === "a" ? cost.b.per100 : cost.a.per100) : 50);

  const pick = (sa: number, sb: number): "a" | "b" | "tie" => (Math.abs(sa - sb) < 4 ? "tie" : sa > sb ? "a" : "b");

  const sensWinner = pick(sens(A), sens(B));
  const sensReasons: string[] = [];
  const fa = A.featureChecklist, fb = B.featureChecklist;
  if (fa?.sulfateFree != null && fb?.sulfateFree != null && fa.sulfateFree !== fb.sulfateFree) sensReasons.push(`${fa.sulfateFree ? nameA : nameB} sülfatsız, ${fa.sulfateFree ? nameB : nameA} sülfat içeriyor.`);
  if (fa?.fragranceFree != null && fb?.fragranceFree != null && fa.fragranceFree !== fb.fragranceFree) sensReasons.push(`${fa.fragranceFree ? nameA : nameB} parfümsüz.`);
  const ca = fa?.certificates.length ?? 0, cb = fb?.certificates.length ?? 0;
  if (ca !== cb) sensReasons.push(`${ca > cb ? nameA : nameB} dermatolojik/pediatrik sertifikaya sahip.`);
  const ra = A.inputs.complaintRate ?? 0, rb = B.inputs.complaintRate ?? 0;
  if (Math.abs(ra - rb) >= 0.05) sensReasons.push(`${ra < rb ? nameA : nameB} ürününde şikayet oranı daha düşük (%${Math.round(Math.min(ra, rb) * 100)} vs %${Math.round(Math.max(ra, rb) * 100)}).`);
  if (Math.abs(A.noSting - B.noSting) >= 10) sensReasons.push(`${A.noSting > B.noSting ? nameA : nameB} göz yakmama açısından daha iyi.`);
  if (sensReasons.length === 0) sensReasons.push("Hassasiyet göstergelerinde belirgin bir fark yok.");

  const budgetWinner = pick(budget(A, "a"), budget(B, "b"));
  const budgetReasons: string[] = [];
  if (cost.comparable && cost.cheaper && (cost.diffPct ?? 0) >= 5) budgetReasons.push(`${cost.cheaper === "a" ? nameA : nameB} birim maliyetinde %${cost.diffPct} daha ucuz (${cost.a.text} vs ${cost.b.text}).`);
  if (Math.abs(A.inputs.valueForMoney - B.inputs.valueForMoney) >= 10) budgetReasons.push(`${A.inputs.valueForMoney > B.inputs.valueForMoney ? nameA : nameB} fiyat/performans skorunda önde (${Math.max(A.inputs.valueForMoney, B.inputs.valueForMoney)} vs ${Math.min(A.inputs.valueForMoney, B.inputs.valueForMoney)}).`);
  if (cost.yearly && cost.yearly.diff >= 20) budgetReasons.push(`Tahmini yıllık maliyet farkı ≈ ${fmtTl(cost.yearly.diff)} TL (${cost.yearly.cheaper === "a" ? nameA : nameB} daha ucuz).`);
  if (budgetReasons.length === 0) budgetReasons.push("Maliyet göstergelerinde belirgin bir fark yok.");

  return [
    { title: "Hassas / Yenidoğan Cilt için Hangisi?", winner: sensWinner, reasons: sensReasons.slice(0, 3) },
    { title: "Bütçe ve Günlük Kullanım için Hangisi?", winner: budgetWinner, reasons: budgetReasons.slice(0, 3) },
  ];
}

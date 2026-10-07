import { normTr } from "@/lib/text";
import { starsToScore } from "@/lib/scoring";
import type { Category, Review, ReviewFlag } from "@/types";

interface Rule { label: string; pattern: RegExp }

// Desenler normTr çıktısına (küçük harf, aksansız) göre yazılır
const COMPLAINTS: Record<Category, Rule[]> = {
  baby: [
    { label: "Pişik yaptı", pattern: /pisik\s+(yapti|yapiyor|yapar|oldu|cikardi)/ },
    { label: "Kızarıklık", pattern: /kizariklik/ },
    { label: "Alerji riski", pattern: /alerj/ },
    { label: "Tahriş", pattern: /tahris/ },
    { label: "Kokusu ağır", pattern: /kokusu\s+(cok\s+)?(agir|kotu|rahatsiz)|agir\s+koku/ },
    { label: "Küçük geldi", pattern: /kucuk\s+geldi|dar\s+geldi/ },
  ],
  cosmetics: [
    { label: "Sivilce yaptı", pattern: /sivilce\s+(yapti|yapiyor|cikardi|oldu)|sivilce\s+cikar/ },
    { label: "Komedon / gözenek tıkama", pattern: /komedon|gozenek\s+tik/ },
    { label: "Yağlandırdı", pattern: /yaglandir|yagli\s+his/ },
    { label: "Yanma yaptı", pattern: /yanma\s+(yapti|hissi)|yaniyor|batma/ },
    { label: "Etki etmedi", pattern: /etki\s+etmedi|etkisi\s+yok|fayda\s+gormedim/ },
  ],
  food: [
    { label: "Tarihi geçmiş", pattern: /tarihi\s+gecmis|son\s+kullanma\s+tarihi\s+gec/ },
    { label: "Bayat", pattern: /bayat/ },
    { label: "Şekeri çok", pattern: /sekeri\s+cok|cok\s+sekerli|asiri\s+sekerli/ },
    { label: "Bozuk çıktı", pattern: /bozuk\s+cik|kokmus|kurtlu|kuflu/ },
    { label: "Ambalaj patlak", pattern: /ambalaj\s+(patlak|yirtik|acik|hasarli)|patlak\s+geldi/ },
  ],
  cleaning: [
    { label: "Kokusu ağır", pattern: /kokusu\s+(cok\s+)?(agir|keskin)|keskin\s+koku/ },
    { label: "Tahriş", pattern: /tahris|eli(m|mi)?\s+(yardi|kurudu)|kuruttu/ },
    { label: "Etki etmedi", pattern: /temizlemedi|etki\s+etmedi|leke\s+cikmadi/ },
    { label: "Ambalaj sorunu", pattern: /ambalaj\s+(patlak|yirtik|acik)|akmis|sizdirdi/ },
  ],
};

const PROS: Rule[] = [
  { label: "Hızlı iyileşme", pattern: /hizli\s+(iyiles|etki|gecti)|hemen\s+gecti|iyilesti|gunde\s+gecti/ },
  { label: "Hassas cilde uygun", pattern: /(tahris|alerji|kizariklik|pisik)\s+(yapmadi|yapmiyor|olmadi)|hassas\s+cild?\w*\s+(icin\s+)?(uygun|sorunsuz)/ },
  { label: "Güzel koku", pattern: /guzel\s+koku|kokusu\s+(cok\s+)?(guzel|hos)|hos\s+koku/ },
  { label: "Fiyat/performans", pattern: /fiyat\W{0,3}performans|uygun\s+fiyat|ekonomik|uzun\s+gidiyor/ },
  { label: "Göz yakmaz", pattern: /goz\w*\s+(yakmiyor|yakmadi|yakmaz)/ },
  { label: "Lezzetli", pattern: /lezzetli|tadi\s+(cok\s+)?(guzel|harika)/ },
  { label: "Etkili", pattern: /etkili|ise\s+yaradi|memnun\s+kaldim|fark\s+ettim/ },
];

const NEGATION = /^.{0,25}?(yapmadi|yapmiyor|olmadi|yok\b|degil)/;

// Olumsuzlama ("alerji yapmadı") şikayet sayılmaz
function hits(rules: Rule[], text: string): Rule[] {
  return rules.filter((r) => {
    const m = r.pattern.exec(text);
    return !!m && !NEGATION.test(text.slice(m.index + m[0].length));
  });
}

/** Puanı olmayan snippet'lar için sözlükten tahmini yıldız (1-5). */
export function inferRating(text: string, category: Category): 1 | 2 | 3 | 4 | 5 {
  const t = normTr(text);
  const score = 3 + hits(PROS, t).length - 1.5 * hits(COMPLAINTS[category], t).length;
  return Math.min(5, Math.max(1, Math.round(score))) as 1 | 2 | 3 | 4 | 5;
}

export interface ReviewAnalysis {
  analyzed: boolean;
  reviewScore: number; // 0-100
  complaintRate: number; // 0-1
  topPros: string[];
  topCons: string[];
  sampleReviews: Review[];
}

const top = (counts: Map<string, number>, n = 2) =>
  [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);

export function analyzeReviews(category: Category, reviews: Review[]): ReviewAnalysis {
  if (reviews.length === 0) return { analyzed: false, reviewScore: 0, complaintRate: 0, topPros: [], topCons: [], sampleReviews: [] };

  const pros = new Map<string, number>(), cons = new Map<string, number>();
  let complained = 0;
  const tagged = reviews.map((r) => {
    const t = normTr(r.text);
    const c = hits(COMPLAINTS[category], t), p = hits(PROS, t);
    if (c.length) complained++;
    c.forEach((x) => cons.set(x.label, (cons.get(x.label) ?? 0) + 1));
    p.forEach((x) => pros.set(x.label, (pros.get(x.label) ?? 0) + 1));
    const flags: ReviewFlag[] = [
      ...c.map((x) => ({ kind: "risk" as const, label: x.label })),
      ...p.map((x) => ({ kind: "positive" as const, label: x.label })),
    ];
    return { ...r, flags: r.flags.length ? r.flags : flags };
  });

  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  // Örnek: en iyi 2 + en kötü/şikayetli 2, tekrarsız
  const byRating = [...tagged].sort((a, b) => b.rating - a.rating);
  const worst = [...tagged].sort((a, b) => a.rating - b.rating || b.flags.length - a.flags.length);
  const sample = [...byRating.slice(0, 2), ...worst.slice(0, 2)].filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i);

  return {
    analyzed: true,
    reviewScore: Math.round(starsToScore(avg)),
    complaintRate: Math.round((complained / reviews.length) * 100) / 100,
    topPros: top(pros),
    topCons: top(cons),
    sampleReviews: sample,
  };
}

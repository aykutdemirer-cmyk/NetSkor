import { normTr } from "@/lib/text";

// INCI listesi olmayan ürünlerde (bebek bezi, ıslak mendil...) başlık/açıklamadaki üretici beyanları
const CLAIMS: { label: string; pattern: RegExp }[] = [
  { label: "Parfümsüz", pattern: /parfumsuz|kokusuz|fragrance[-\s]?free/ },
  { label: "Pamuksu", pattern: /pamuk/ },
  { label: "Losyonsuz", pattern: /losyonsuz|lotion[-\s]?free/ },
  { label: "Klor içermez", pattern: /klor\w*\s+(icermez|iceremez|yok|free)|klorsuz|chlorine[-\s]?free/ },
  { label: "Alkolsüz", pattern: /alkolsuz|alcohol[-\s]?free/ },
  { label: "Paraben içermez", pattern: /parabensiz|paraben\s+(icermez|free)/ },
  { label: "Hipoalerjenik", pattern: /hipoalerjenik|hypoallergenic/ },
  { label: "Dermatolojik test", pattern: /dermatolojik/ },
];

export function scanClaims(text: string): string[] {
  const t = normTr(text);
  return CLAIMS.filter((c) => c.pattern.test(t)).map((c) => c.label);
}

/** Klasik içerik (INCI) listesi taşımayan ürün türü mü? (bebek bezi, ped, ıslak mendil) */
export const isNonInci = (name: string) => /\b(bez|bezi|diaper|nappy|mendil|wipes?|ped|islak)\b/.test(normTr(name));

/** Beyan sayısına göre içerik puanı: doğrulanmamış olduğu için en çok 85. */
export const claimScore = (n: number) => Math.min(85, 65 + 7 * n);

import { MOCK_PRODUCTS } from "@/data/mockProducts";
import { normTr } from "@/lib/text";
import type { Category } from "@/types";

export interface Candidate {
  barcode: string;
  name: string;
  brand: string;
  imageUrl?: string;
  category: Category;
}

type Fetcher = typeof fetch;
type Source = "openfoodfacts" | "openbeautyfacts";
const HOSTS: Record<Source, string> = { openfoodfacts: "https://world.openfoodfacts.org", openbeautyfacts: "https://world.openbeautyfacts.org" };
const FIELDS = "code,product_name,product_name_tr,brands,image_front_small_url,image_small_url,categories_tags";
const MAX = 6;

const tokens = (s: string) => normTr(s).split(/[^a-z0-9]+/).filter(Boolean);

function lev1(a: string, b: string): boolean { // Levenshtein <= 1
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

const tokenHit = (q: string, words: string[]) =>
  words.some((w) => w.includes(q) || (q.length >= 5 && w.length >= 5 && lev1(q, w)));

/** 0..1: sorgu kelimelerinin ad+marka içinde bulunma oranı (rakamlar "750" gibi gramaj için de eşleşir). */
export function relevance(query: string, c: Pick<Candidate, "name" | "brand">): number {
  const q = tokens(query);
  if (!q.length) return 0;
  const words = tokens(`${c.brand} ${c.name}`);
  const hit = q.filter((t) => tokenHit(t, words)).length / q.length;
  return hit + (normTr(`${c.brand} ${c.name}`).startsWith(normTr(query).trim()) ? 0.25 : 0);
}

export function detectCategory(source: Source, tags: string[], text: string, selected: Category): Category {
  const hay = `${tags.join(" ")} ${normTr(text)}`;
  if (/baby|infant|bebek|diaper|nappy|\bbez\b/.test(hay)) return "baby";
  if (/clean|deterjan|detergent|sabun|soap|temizlik|hygiene/.test(hay)) return "cleaning";
  if (source === "openfoodfacts") return "food";
  return selected === "food" ? "cosmetics" : selected; // OBF'de kullanıcı seçimi korunur
}

async function searchSource(source: Source, query: string, category: Category, f: Fetcher): Promise<Candidate[]> {
  const url = `${HOSTS[source]}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=12&fields=${FIELDS}`;
  const res = await f(url, { headers: { "User-Agent": "NetSkor/0.1 (netskor.app)" }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`${source} ${res.status}`);
  const j = await res.json();
  return (j.products ?? [])
    .map((p: any): Candidate => ({
      barcode: String(p.code ?? ""),
      name: p.product_name_tr || p.product_name || "",
      brand: (p.brands ?? "").split(",")[0].trim(),
      imageUrl: p.image_front_small_url || p.image_small_url || undefined,
      category: detectCategory(source, p.categories_tags ?? [], `${p.product_name ?? ""} ${p.brands ?? ""}`, category),
    }))
    .filter((c: Candidate) => /^\d{6,14}$/.test(c.barcode) && c.name);
}

/** Demo/mock ürünlerde filtreli fuzzy arama: tüm sorgu kelimeleri eşleşmeli. */
export function searchMock(query: string): Candidate[] {
  return Object.values(MOCK_PRODUCTS)
    .map((d) => ({ barcode: d.product.barcode, name: d.product.name, brand: d.product.brand, category: d.product.category }))
    .filter((c) => relevance(query, c) >= 1);
}

export async function searchProducts(query: string, category: Category, f: Fetcher = fetch): Promise<Candidate[]> {
  const q = query.trim();
  if (!q) return [];
  const order: Source[] = category === "food" ? ["openfoodfacts", "openbeautyfacts"] : ["openbeautyfacts", "openfoodfacts"];

  // İki kaynak paralel; biri düşerse diğeri yeter, ikisi de düşerse yalnızca mock kalır
  const settled = await Promise.allSettled(order.map((s) => searchSource(s, q, category, f)));
  const live = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  const seen = new Set<string>();
  return [...searchMock(q), ...live]
    .filter((c) => !seen.has(c.barcode) && !!seen.add(c.barcode))
    .map((c) => ({ c, s: relevance(q, c) }))
    .sort((a, b) => b.s - a.s) // sort kararlı: eşitlikte mock/birincil kaynak önde kalır
    .slice(0, MAX)
    .map(({ c }) => c);
}

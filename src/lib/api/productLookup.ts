import type { Category } from "@/types";

export interface LookupResult {
  barcode: string;
  name: string;
  brand: string;
  imageUrl?: string;
  ingredientsText?: string;
  analysisTags: string[]; // ingredients_analysis_tags + additives_tags
  nutriscore?: string;
  categoryTags?: string[];
  description?: string; // web aramasında ürün başlığı/özet metinleri (beyan taraması için)
  category?: Category; // yalnızca kullanıcı katkısında: katkıda bulunanın seçtiği kategori
  quantity?: string;
  source: "openfoodfacts" | "openbeautyfacts" | "web" | "user";
}

const HOSTS = {
  openfoodfacts: "https://world.openfoodfacts.org",
  openbeautyfacts: "https://world.openbeautyfacts.org",
} as const;
type Source = keyof typeof HOSTS;

const FIELDS = [
  "code", "product_name", "product_name_tr", "brands", "image_url", "image_front_url",
  "ingredients_text", "ingredients_text_tr", "ingredients_analysis_tags", "additives_tags", "nutriscore_grade", "quantity", "categories_tags",
].join(",");

type Fetcher = typeof fetch;

async function query(source: Source, barcode: string, f: Fetcher): Promise<LookupResult | null> {
  try {
    const res = await f(`${HOSTS[source]}/api/v2/product/${barcode}.json?fields=${FIELDS}`, {
      headers: { "User-Agent": "NetSkor/0.1 (netskor.app)" },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 86400 },
    } as RequestInit);
    if (!res.ok) return null;
    const json = await res.json();
    const p = json?.product;
    if (json?.status !== 1 || !p) return null; // status 0 = kayıt yok
    return {
      barcode,
      name: p.product_name_tr || p.product_name || "",
      brand: (p.brands ?? "").split(",")[0].trim(),
      imageUrl: p.image_url || p.image_front_url || undefined,
      ingredientsText: p.ingredients_text_tr || p.ingredients_text || undefined,
      analysisTags: [...(p.ingredients_analysis_tags ?? []), ...(p.additives_tags ?? [])],
      nutriscore: p.nutriscore_grade,
      quantity: p.quantity,
      categoryTags: p.categories_tags ?? [],
      source,
    };
  } catch {
    return null; // ağ/timeout hatası: fallback zincirine devam
  }
}

/** Gıda -> OFF; diğerleri -> OBF. İlk kaynakta yoksa diğerine düşer. */
export async function lookupProduct(barcode: string, category: Category, f: Fetcher = fetch): Promise<LookupResult | null> {
  if (!/^\d{6,14}$/.test(barcode)) return null; // ürün adı araması sonraki adım
  const order: Source[] = category === "food" ? ["openfoodfacts", "openbeautyfacts"] : ["openbeautyfacts", "openfoodfacts"];
  for (const s of order) {
    const r = await query(s, barcode, f);
    if (r && r.name) return r;
  }
  return null;
}

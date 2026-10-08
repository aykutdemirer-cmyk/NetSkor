import { cacheGet, cacheSet } from "@/lib/cache";
import { getContribution } from "@/lib/contrib";
import { MOCK_PRODUCTS } from "@/data/mockProducts";
import { webLookupProduct } from "./webLookup";
import { detectCategory } from "./productSearch";
import { lookupProduct } from "./productLookup";
import { mapToAnalysis } from "./mapToAnalysis";
import { enrichWithReviews } from "./enrich";
import type { Category, ProductAnalysis } from "@/types";

/** Barkoddan tam analiz: mock havuzu -> OFF/OBF + yorum/fiyat pipeline'ı. Bulunamazsa null. */
export async function enrichProduct(
  barcode: string,
  category: Category = "baby",
  f?: typeof fetch,
  env?: Record<string, string | undefined>,
): Promise<ProductAnalysis | null> {
  const mock = MOCK_PRODUCTS[barcode];
  if (mock) return mock;

  // Önce önbellek: aynı ürün tekrar açıldığında arama kotası harcanmaz
  const key = `analysis:v2:${barcode}:${category}`;
  const cached = await cacheGet<ProductAnalysis>(key, env, f);
  if (cached) return cached;
  const result = await analyze(barcode, category, f, env);
  // Demo veri ve bulunamayanlar saklanmaz: anahtar eklenince veya ürün kaydedilince güncel sonuç görünsün
  if (result && result.reviewMode !== "demo") await cacheSet(key, result, 7 * 24 * 3600, env, f);
  return result;
}

async function analyze(barcode: string, category: Category, f?: typeof fetch, env?: Record<string, string | undefined>): Promise<ProductAnalysis | null> {
  // Sıra: kullanıcı katkısı -> Open Facts -> internet araması (SerpAPI anahtarı gerekir)
  const found =
    (await getContribution(barcode, env, f)) ?? (await lookupProduct(barcode, category, f)) ?? (await webLookupProduct(barcode, category, f, env));
  if (!found) return null;
  // Kullanıcının seçtiği kategori yanlış olabilir (ör. bebek seçiliyken Nutella): kaynak ve etiketlerden belirle
  const detected = found.category ?? detectCategory(found.source === "user" ? "web" : found.source, found.categoryTags ?? [], `${found.name} ${found.brand}`, category);
  return enrichWithReviews(mapToAnalysis(found, detected), f, env, "prices" in found ? (found as { prices: number[] }).prices : []);
}

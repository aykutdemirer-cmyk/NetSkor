import { MOCK_PRODUCTS } from "@/data/mockProducts";
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
  const found = await lookupProduct(barcode, category, f);
  if (!found) return null;
  return enrichWithReviews(mapToAnalysis(found, category), f, env);
}

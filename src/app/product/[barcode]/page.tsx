import ScoreCard from "@/components/ScoreCard";
import ReviewList from "@/components/ReviewList";
import ProductNotFound from "@/components/ProductNotFound";
import { MOCK_PRODUCTS } from "@/data/mockProducts";
import { lookupProduct } from "@/lib/api/productLookup";
import { mapToAnalysis } from "@/lib/api/mapToAnalysis";
import { enrichWithReviews } from "@/lib/api/enrich";
import type { Category } from "@/types";

const CATEGORIES: Category[] = ["baby", "cosmetics", "food", "cleaning"];

export default async function ProductPage({ params, searchParams }: { params: { barcode: string }; searchParams: { c?: string } }) {
  const barcode = decodeURIComponent(params.barcode);
  const category = CATEGORIES.find((c) => c === searchParams.c) ?? "baby";

  // 1) demo mock -> 2) Open Food/Beauty Facts -> 3) bulunamadı kartı
  let data = MOCK_PRODUCTS[barcode];
  if (!data) {
    const found = await lookupProduct(barcode, category);
    if (found) data = await enrichWithReviews(mapToAnalysis(found, category));
  }
  if (!data) return <ProductNotFound query={barcode} />;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <ScoreCard data={data} />
      {data.reviewMode === "demo" && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Demo verisi: arama API anahtarı (SERPAPI_KEY / GOOGLE_SEARCH_API_KEY) tanımlı değil ya da ulaşılamadı. Aşağıdaki yorumlar ve fiyatlar gerçek değil, örnek amaçlı deterministik üretilmiştir.
        </p>
      )}
      {data.reviews.length > 0 ? (
        <ReviewList reviews={data.reviews} />
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-500">
          Bu ürün için henüz yorum toplanmadı.
        </p>
      )}
    </main>
  );
}

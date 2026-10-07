import ScoreCard from "@/components/ScoreCard";
import ReviewList from "@/components/ReviewList";
import ProductNotFound from "@/components/ProductNotFound";
import { MOCK_PRODUCTS } from "@/data/mockProducts";
import { lookupProduct } from "@/lib/api/productLookup";
import { mapToAnalysis } from "@/lib/api/mapToAnalysis";
import type { Category } from "@/types";

const CATEGORIES: Category[] = ["baby", "cosmetics", "food", "cleaning"];

export default async function ProductPage({ params, searchParams }: { params: { barcode: string }; searchParams: { c?: string } }) {
  const barcode = decodeURIComponent(params.barcode);
  const category = CATEGORIES.find((c) => c === searchParams.c) ?? "baby";

  // 1) demo mock -> 2) Open Food/Beauty Facts -> 3) bulunamadı kartı
  let data = MOCK_PRODUCTS[barcode];
  if (!data) {
    const found = await lookupProduct(barcode, category);
    if (found) data = mapToAnalysis(found, category);
  }
  if (!data) return <ProductNotFound query={barcode} />;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <ScoreCard data={data} />
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

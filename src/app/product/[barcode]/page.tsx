import ScoreCard from "@/components/ScoreCard";
import IngredientBlock from "@/components/IngredientBlock";
import UnitCostCard from "@/components/UnitCostCard";
import AgeSatisfaction from "@/components/AgeSatisfaction";
import ReviewList from "@/components/ReviewList";
import ProductNotFound from "@/components/ProductNotFound";
import { enrichProduct } from "@/lib/api/enrichProduct";
import { getConfidence } from "@/lib/confidence";
import HistoryRecorder from "@/components/HistoryRecorder";
import { calculateScore } from "@/lib/scoring";
import type { Category } from "@/types";

const CATEGORIES: Category[] = ["baby", "cosmetics", "food", "cleaning"];

export default async function ProductPage({ params, searchParams }: { params: { barcode: string }; searchParams: { c?: string } }) {
  const barcode = decodeURIComponent(params.barcode);
  const category = CATEGORIES.find((c) => c === searchParams.c) ?? "baby";

  const data = await enrichProduct(barcode, category); // mock -> API -> null
  if (!data) return <ProductNotFound query={barcode} />;

  const sample = !data.productSource && !data.reviewMode; // elle yazılmış demo ürün: yeni bloklar "Örnek veri" etiketli
  const { total, band } = calculateScore(data.product.category, data.inputs);
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      {getConfidence(data).showScore && (
        <HistoryRecorder
          item={{ barcode: data.product.barcode, name: data.product.name, brand: data.product.brand, imageUrl: data.product.imageUrl, category: data.product.category, score: total, band }}
        />
      )}
      <ScoreCard data={data} />
      <IngredientBlock highlights={data.inciHighlights} ingredients={data.product.ingredients} contentBasis={data.contentBasis} sample={sample} />
      <UnitCostCard pricePerUnit={data.pricePerUnit} categoryAveragePrice={data.categoryAveragePrice} sample={sample} />
      <AgeSatisfaction rows={data.ageGroupSatisfaction} sample={sample} />
      {data.reviewMode === "demo" && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Yorum verisi alınamadı: arama anahtarı tanımlı değil ya da arama servislerine ulaşılamadı. Bu nedenle yorum skoru gösterilmiyor.
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

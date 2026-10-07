import { notFound } from "next/navigation";
import ScoreCard from "@/components/ScoreCard";
import ReviewList from "@/components/ReviewList";
import { MOCK_PRODUCTS } from "@/data/mockProducts";

export default function ProductPage({ params }: { params: { barcode: string } }) {
  const data = MOCK_PRODUCTS[decodeURIComponent(params.barcode)];
  if (!data) notFound(); // Gerçek API Katman 5+'da bağlanacak
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <ScoreCard data={data} />
      <ReviewList reviews={data.reviews} />
    </main>
  );
}

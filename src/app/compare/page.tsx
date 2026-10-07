import Link from "next/link";
import { notFound } from "next/navigation";
import CompareView, { ProductPicker } from "@/components/CompareView";
import { MOCK_PRODUCTS } from "@/data/mockProducts";

export default function ComparePage({ searchParams }: { searchParams: { a?: string; b?: string } }) {
  const A = searchParams.a ? MOCK_PRODUCTS[searchParams.a] : undefined;
  if (!A) notFound();
  const B = searchParams.b && searchParams.b !== searchParams.a ? MOCK_PRODUCTS[searchParams.b] : undefined;
  const others = Object.values(MOCK_PRODUCTS).filter((p) => p.product.barcode !== A.product.barcode);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <Link href={`/product/${A.product.barcode}`} className="text-sm text-slate-400">← Ürüne Dön</Link>
      {B ? <CompareView A={A} B={B} /> : <ProductPicker base={A} options={others} />}
    </main>
  );
}

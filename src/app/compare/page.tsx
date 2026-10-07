import Link from "next/link";
import { redirect } from "next/navigation";
import CompareView from "@/components/CompareView";
import ComparePicker from "@/components/ComparePicker";
import CompareError from "@/components/CompareError";
import { MOCK_PRODUCTS } from "@/data/mockProducts";
import { enrichProduct } from "@/lib/api/enrichProduct";
import { searchProducts } from "@/lib/api/productSearch";
import type { Category } from "@/types";

const CATEGORIES: Category[] = ["baby", "cosmetics", "food", "cleaning"];
const isBarcode = (s: string) => /^\d{6,14}$/.test(s);

export default async function ComparePage({ searchParams }: { searchParams: { a?: string; b?: string; c?: string; q?: string } }) {
  const category = CATEGORIES.find((c) => c === searchParams.c) ?? "baby";
  const a = (searchParams.a ?? "").trim(), b = (searchParams.b ?? "").trim(), q = (searchParams.q ?? "").trim().slice(0, 100);
  if (!a) return <Shell><CompareError missing={["birinci ürün"]} retryHref="/" retryLabel="Ürün Seç" /></Shell>;

  // Barkod yazıldıysa arama listesi göstermeden doğrudan karşılaştırmaya geç
  if (!b && isBarcode(q)) redirect(`/compare?a=${a}&b=${q}&c=${category}`);

  const [A, B] = await Promise.all([enrichProduct(a, category), b ? enrichProduct(b, category) : null]);
  const missing = [!A && a, b && !B && b].filter(Boolean) as string[];
  if (missing.length) {
    // A bulunduysa yalnızca ikinci ürünü yeniden seçtir
    return <Shell><CompareError missing={missing} retryHref={A ? `/compare?a=${a}&c=${category}` : "/"} retryLabel={A ? "İkinci Ürünü Yeniden Seç" : "Yeni Ürün Seç"} /></Shell>;
  }

  if (!B) {
    const all = Object.values(MOCK_PRODUCTS).filter((p) => p.product.barcode !== a);
    const same = all.filter((p) => p.product.category === A!.product.category);
    const results = q ? await searchProducts(q, A!.product.category) : [];
    return <Shell back={`/product/${a}?c=${category}`}><ComparePicker base={A!} popular={same.length ? same : all} query={q} results={results} /></Shell>;
  }

  return <Shell back={`/product/${a}?c=${category}`}><CompareView A={A!} B={B} /></Shell>;
}

function Shell({ children, back }: { children: React.ReactNode; back?: string }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      {back && <Link href={back} className="text-sm text-slate-400">← Ürüne Dön</Link>}
      {children}
    </main>
  );
}

import Link from "next/link";
import SearchResults from "@/components/SearchResults";
import { searchProducts } from "@/lib/api/productSearch";
import type { Category } from "@/types";

const CATEGORIES: Category[] = ["baby", "cosmetics", "food", "cleaning"];

export default async function SearchPage({ searchParams }: { searchParams: { q?: string; c?: string } }) {
  const q = (searchParams.q ?? "").trim().slice(0, 100);
  const category = CATEGORIES.find((c) => c === searchParams.c) ?? "baby";
  const results = q ? await searchProducts(q, category) : [];

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
      <Link href="/" className="text-sm text-slate-400">← Yeni Ürün Tara</Link>
      <h1 className="text-lg font-bold">“{q}” için sonuçlar</h1>
      <SearchResults query={q} results={results} />
    </main>
  );
}

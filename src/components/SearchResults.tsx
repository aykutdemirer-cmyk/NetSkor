import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { CATEGORIES } from "@/data/categories";
import type { Candidate } from "@/lib/api/productSearch";

export default function SearchResults({ query, results }: { query: string; results: Candidate[] }) {
  if (results.length === 0)
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-center">
        <PackageSearch className="mx-auto mb-3 h-10 w-10 text-amber-400" />
        <p className="font-semibold">“{query}” için sonuç yok</p>
        <p className="mt-1 text-sm text-slate-400">Aradığınız kriterde ürün bulunamadı, farklı kelimeler deneyin veya barkod okutun.</p>
      </div>
    );

  return (
    <ul className="flex flex-col gap-3">
      {results.map((c) => {
        const cat = CATEGORIES.find((x) => x.id === c.category)!;
        return (
          <li key={c.barcode}>
            <Link href={`/product/${c.barcode}?c=${c.category}`}
              className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 transition hover:border-cyan-400">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-800">
                {c.imageUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.imageUrl} alt="" className="h-full w-full object-contain" />
                  : <cat.Icon className="h-7 w-7 text-slate-500" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs uppercase tracking-wider text-slate-500">{c.brand || "Marka yok"}</p>
                <p className="text-sm font-semibold leading-tight">{c.name}</p>
                <span className="mt-1 inline-block rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] text-violet-300">{cat.label}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

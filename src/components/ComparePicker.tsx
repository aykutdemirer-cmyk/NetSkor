import Link from "next/link";
import { Search } from "lucide-react";
import { CATEGORIES } from "@/data/categories";
import type { Candidate } from "@/lib/api/productSearch";
import type { ProductAnalysis } from "@/types";

interface Props {
  base: ProductAnalysis;
  popular: ProductAnalysis[];
  query: string;
  results: Candidate[];
}

export default function ComparePicker({ base, popular, query, results }: Props) {
  const a = base.product.barcode, c = base.product.category;
  const href = (b: string) => `/compare?a=${a}&b=${b}&c=${c}`;
  const row = "flex items-center gap-3 rounded-xl border border-slate-700 px-4 py-3 text-sm hover:border-cyan-400";

  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
      <div>
        <h1 className="text-lg font-bold">Karşılaştırılacak İkinci Ürünü Seçin</h1>
        <p className="text-sm text-slate-400">{base.emoji} {base.product.name} ile kıyaslanacak.</p>
      </div>

      {/* GET formu: JS gerekmeden çalışır; barkod girilirse sayfa doğrudan karşılaştırmaya yönlendirir */}
      <form action="/compare" className="flex gap-2">
        <input type="hidden" name="a" value={a} />
        <input type="hidden" name="c" value={c} />
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 focus-within:border-cyan-400">
          <Search className="h-4 w-4 text-slate-500" />
          <input name="q" defaultValue={query} placeholder="Barkod veya ürün adı" className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-600" />
        </div>
        <button className="rounded-xl bg-violet-600 px-4 text-sm font-semibold">Ara</button>
      </form>

      {query && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs uppercase tracking-wider text-slate-500">“{query}” sonuçları</h2>
          {results.length === 0 && <p className="text-sm text-slate-400">Aradığınız kriterde ürün bulunamadı, farklı kelimeler deneyin veya barkod girin.</p>}
          {results.filter((r) => r.barcode !== a).map((r) => (
            <Link key={r.barcode} href={href(r.barcode)} className={row}>
              <span className="text-xs text-slate-500">{r.brand}</span>
              <span className="flex-1">{r.name}</span>
              <span className="text-[11px] text-violet-300">{CATEGORIES.find((x) => x.id === r.category)?.label}</span>
            </Link>
          ))}
        </div>
      )}

      {popular.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs uppercase tracking-wider text-slate-500">Popüler / Demo Ürünler</h2>
          {popular.map((o) => (
            <Link key={o.product.barcode} href={href(o.product.barcode)} className={row}>
              <span>{o.emoji}</span><span className="flex-1">{o.product.name}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

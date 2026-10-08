import Link from "next/link";
import { SearchX } from "lucide-react";

export default function ProductNotFound({ query }: { query: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-[0_0_30px_-10px_#8b5cf6]">
        <SearchX className="mx-auto mb-3 h-10 w-10 text-amber-400" />
        <h1 className="text-lg font-bold">Ürün bulunamadı</h1>
        <p className="mt-1 text-sm text-slate-400">
          <span className="font-mono text-slate-300">{query}</span> için kayıt yok. Elle katkıda bulunabilir ya da ürün adıyla arayabilirsin.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href={`/contribute?barcode=${encodeURIComponent(query)}`} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold">Ürünü Ekle</Link>
          <Link href="/" className="rounded-xl border border-slate-700 px-4 py-2 text-sm">← Yeni Ürün Tara</Link>
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface Props { missing: string[]; retryHref: string; retryLabel: string }

export default function CompareError({ missing, retryHref, retryLabel }: Props) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-center">
      <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-400" />
      <h1 className="text-lg font-bold">Karşılaştırılamıyor</h1>
      <p className="mt-1 text-sm text-slate-400">
        Ürün verisi yüklenemedi: <span className="font-mono text-slate-300">{missing.join(", ")}</span>. Kayıt bulunamadı ya da servise ulaşılamadı.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href={retryHref} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold">{retryLabel}</Link>
        <Link href="/" className="rounded-xl border border-slate-700 px-4 py-2 text-sm">← Yeni Ürün Tara</Link>
      </div>
    </section>
  );
}

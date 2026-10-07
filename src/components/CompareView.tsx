import { Scale, Sparkles } from "lucide-react";
import { compareProducts } from "@/lib/compare";
import type { ProductAnalysis } from "@/types";

const tone = (v: number, o: number) => (v > o ? "text-green-400 font-bold" : v < o ? "text-slate-500" : "text-slate-300");

export default function CompareView({ A, B }: { A: ProductAnalysis; B: ProductAnalysis }) {
  const r = compareProducts(A, B);
  return (
    <section className="flex flex-col gap-5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        {[A, B].map((d, i) => (
          <div key={d.product.barcode} className={`${i === 1 ? "order-3" : ""} rounded-2xl border p-3 ${r.winner === (i ? "b" : "a") ? "border-green-500" : "border-slate-800"} bg-slate-900/60`}>
            <div className="text-3xl">{d.emoji}</div>
            <div className="text-xs text-slate-500">{d.product.brand}</div>
            <div className="text-sm font-semibold leading-tight">{d.product.name}</div>
            <div className="mt-1 text-2xl font-extrabold">{i ? r.totalB : r.totalA}</div>
          </div>
        ))}
        <Scale className="order-2 h-6 w-6 text-violet-400" />
      </div>

      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500"><tr><th className="py-2 text-left">Kriter</th><th>{A.product.brand}</th><th>{B.product.brand}</th></tr></thead>
        <tbody>
          {r.criteria.map((c) => (
            <tr key={c.key} className="border-t border-slate-800 text-center">
              <td className="py-2 text-left">{c.label} <span className="text-xs text-slate-600">%{Math.round(c.weight * 100)}</span></td>
              <td className={tone(c.a, c.b)}>{c.a}</td>
              <td className={tone(c.b, c.a)}>{c.b}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rounded-2xl bg-violet-500/10 p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-violet-300" /> Claude Karar Özeti — Hangisini ne zaman tercih etmelisiniz?</h3>
        <ul className="space-y-1.5 text-sm">{r.verdict.map((v) => <li key={v}>• {v}</li>)}</ul>
      </div>
    </section>
  );
}

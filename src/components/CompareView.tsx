import { Scale, Sparkles } from "lucide-react";
import { compareProducts, contentChecks, costCompare, scenarioPicks, type Check } from "@/lib/compare";
import { fmtTl } from "@/lib/scoring/priceEstimator";
import type { ProductAnalysis } from "@/types";

const okTone = (c: Check) => (c.ok === true ? "text-green-400" : c.ok === false ? "text-red-400" : "text-slate-500");
const Sample = () => <span className="rounded-full bg-slate-500/20 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">Örnek veri</span>;

const tone = (v: number, o: number) => (v > o ? "text-green-400 font-bold" : v < o ? "text-slate-500" : "text-slate-300");

export default function CompareView({ A, B }: { A: ProductAnalysis; B: ProductAnalysis }) {
  const r = compareProducts(A, B);
  const rows = contentChecks(A, B);
  const cost = costCompare(A, B);
  const scenarios = scenarioPicks(A, B);
  const sample = [A, B].some((d) => !d.productSource && !d.reviewMode); // elle yazılmış demo ürün içeriyor
  const nameOf = (w: "a" | "b" | "tie") => (w === "a" ? A.product.brand : w === "b" ? B.product.brand : null);
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

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">İçerik Kontrolü {sample && <Sample />}</h3>
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500"><tr><th className="py-1 text-left">Madde</th><th>{A.product.brand}</th><th>{B.product.brand}</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-slate-800 text-center">
                <td className="py-2 text-left">{row.label}</td>
                <td className={`px-1 ${okTone(row.a)}`}>{row.a.text}</td>
                <td className={`px-1 ${okTone(row.b)}`}>{row.b.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">Maliyet ve Bütçe {sample && <Sample />}</h3>
        <div className="grid grid-cols-2 gap-3 text-center text-sm">
          {([["a", A, cost.a], ["b", B, cost.b]] as const).map(([k, d, sd]) => (
            <div key={k} className={`rounded-xl p-3 ${cost.cheaper === k ? "bg-green-500/10" : "bg-slate-800/50"}`}>
              <div className="text-xs text-slate-500">{d.product.brand}</div>
              <div className="font-bold">{sd.text}</div>
            </div>
          ))}
        </div>
        {cost.comparable && cost.cheaper && <p className="mt-2 text-xs text-slate-300">{cost.cheaper === "a" ? A.product.brand : B.product.brand} birim maliyette %{cost.diffPct} daha ucuz.</p>}
        {!cost.comparable && <p className="mt-2 text-xs text-slate-500">Birimler farklı olduğu için doğrudan kıyaslanamıyor.</p>}
        {cost.yearly && (
          <p className="mt-2 text-xs text-slate-300">
            Tahmini yıllık maliyet: {A.product.brand} ≈ {fmtTl(cost.yearly.a)} TL, {B.product.brand} ≈ {fmtTl(cost.yearly.b)} TL. Fark ≈ {fmtTl(cost.yearly.diff)} TL.
            <span className="block text-slate-500">Varsayım: {cost.yearly.assumption}.</span>
          </p>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {scenarios.map((sc) => (
          <section key={sc.title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h3 className="mb-2 text-sm font-semibold">{sc.title}</h3>
            <p className={`mb-2 text-base font-bold ${sc.winner === "tie" ? "text-slate-300" : "text-green-400"}`}>{nameOf(sc.winner) ?? "Başa baş"}</p>
            <ul className="space-y-1 text-xs text-slate-300">{sc.reasons.map((x) => <li key={x}>• {x}</li>)}</ul>
          </section>
        ))}
      </div>

      <div className="rounded-2xl bg-violet-500/10 p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-violet-300" /> Claude Karar Özeti — Hangisini ne zaman tercih etmelisiniz?</h3>
        <ul className="space-y-1.5 text-sm">{r.verdict.map((v) => <li key={v}>• {v}</li>)}</ul>
      </div>
    </section>
  );
}

import { Coins } from "lucide-react";
import { fmtTl, vsAverage } from "@/lib/scoring/priceEstimator";
import type { PricePerUnit } from "@/types";

interface Props { pricePerUnit?: PricePerUnit; categoryAveragePrice?: number; sample?: boolean }

export default function UnitCostCard({ pricePerUnit: ppu, categoryAveragePrice: avg, sample }: Props) {
  if (!ppu) return null;
  const label = ppu.label ?? ppu.unit;
  const cmp = avg ? vsAverage(ppu.value, avg) : null;
  // Çubuk: kategori ortalaması = %50; ortalamanın 2 katı ya da daha pahalı = %100
  const fill = avg ? Math.min(100, Math.max(4, (ppu.value / (avg * 2)) * 100)) : 0;

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Coins className="h-4 w-4" /> Birim Maliyet
        {sample && <span className="rounded-full bg-slate-500/20 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">Örnek veri</span>}
      </h2>
      <p className="text-2xl font-extrabold">{fmtTl(Math.round(ppu.value * 100) / 100)} <span className="text-sm font-medium text-slate-400">TL / {label}</span></p>

      {cmp && avg && (
        <>
          <div className="relative h-2 rounded-full bg-slate-800">
            <div className={`h-full rounded-full ${cmp.cheaper ? "bg-green-500" : "bg-red-500"}`} style={{ width: `${fill}%` }} />
            <span className="absolute left-1/2 top-[-3px] h-3.5 w-0.5 bg-slate-500" title="Kategori ortalaması" />
          </div>
          <p className={`text-xs font-semibold ${cmp.pct >= 3 ? "text-green-400" : cmp.pct <= -3 ? "text-red-400" : "text-slate-300"}`}>
            {cmp.text[0].toUpperCase() + cmp.text.slice(1)}
          </p>
          <p className="text-[11px] text-slate-500">Kategori ortalaması ≈ {fmtTl(Math.round(avg * 100) / 100)} TL / {label} (kaba tahmin).</p>
        </>
      )}
    </section>
  );
}

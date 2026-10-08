import { Baby } from "lucide-react";
import type { AgeSatisfaction as Row } from "@/types";

const tone = (pct: number) => (pct >= 90 ? "bg-green-500 text-green-400" : pct >= 70 ? "bg-amber-500 text-amber-400" : "bg-red-500 text-red-400");

export default function AgeSatisfaction({ rows, sample }: { rows?: Row[]; sample?: boolean }) {
  if (!rows || rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Baby className="h-4 w-4" /> Yaş Grubuna Göre Memnuniyet
        {sample && <span className="rounded-full bg-slate-500/20 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">Örnek veri</span>}
      </h2>
      {rows.map((r) => {
        const [bg, text] = tone(r.pct).split(" ");
        return (
          <div key={r.group}>
            <div className="mb-1 flex justify-between text-xs"><span>{r.group}</span><span className={`font-semibold ${text}`}>%{r.pct}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${bg}`} style={{ width: `${r.pct}%` }} /></div>
          </div>
        );
      })}
    </section>
  );
}

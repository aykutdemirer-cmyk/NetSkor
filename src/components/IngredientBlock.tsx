import { FlaskConical } from "lucide-react";
import type { InciHighlight } from "@/types";

const TONE = {
  good: { label: "Temiz / Faydalı", chip: "bg-green-500/15 text-green-300" },
  warn: { label: "Dikkat Edilmeli", chip: "bg-amber-500/15 text-amber-300" },
  risk: { label: "Riskli", chip: "bg-red-500/15 text-red-300" },
} as const;

interface Props {
  highlights?: InciHighlight[];
  ingredients: string[];
  contentBasis?: "inci" | "claims";
  sample?: boolean;
}

export default function IngredientBlock({ highlights = [], ingredients, contentBasis, sample }: Props) {
  if (highlights.length === 0 && ingredients.length === 0) return null;
  const byName = new Map(highlights.map((h) => [h.name.toLowerCase(), h]));
  const groups = (["risk", "warn", "good"] as const).map((tone) => ({ tone, items: highlights.filter((h) => h.tone === tone) })).filter((g) => g.items.length > 0);

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <FlaskConical className="h-4 w-4" /> İçerik Analizi
        {sample && <span className="rounded-full bg-slate-500/20 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">Örnek veri</span>}
      </h2>

      {contentBasis === "claims" && <p className="text-xs text-slate-400">İçerik (INCI) listesi bulunamadı; üretici beyanlarına dayanıyor.</p>}
      {groups.length === 0 && ingredients.length > 0 && <p className="text-xs text-slate-400">Taranan bileşenler arasında öne çıkan faydalı ya da riskli madde yok.</p>}

      {groups.map(({ tone, items }) => (
        <div key={tone}>
          <h3 className="mb-1.5 text-xs font-semibold text-slate-400">{TONE[tone].label}</h3>
          <div className="flex flex-wrap gap-2">
            {items.map((h) => (
              <span key={h.name} className={`rounded-full px-2.5 py-1 text-xs ${TONE[tone].chip}`} title={h.note}>
                {h.name}{h.note && <span className="opacity-70"> · {h.note}</span>}
              </span>
            ))}
          </div>
        </div>
      ))}

      {ingredients.length > 0 && (
        <details className="group rounded-xl bg-slate-800/50 px-3 py-2 text-sm">
          <summary className="cursor-pointer select-none text-xs font-semibold text-cyan-300">Tüm İçerik Listesini Gör ({ingredients.length})</summary>
          <p className="mt-2 flex flex-wrap gap-x-1 gap-y-1 text-xs leading-relaxed text-slate-300">
            {ingredients.map((ing, i) => {
              const h = byName.get(ing.toLowerCase());
              const cls = h ? (h.tone === "good" ? "text-green-300" : h.tone === "warn" ? "text-amber-300" : "text-red-300") : "";
              return <span key={`${ing}-${i}`} className={cls}>{ing}{i < ingredients.length - 1 ? "," : ""}</span>;
            })}
          </p>
        </details>
      )}
    </section>
  );
}

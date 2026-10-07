"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { CATEGORIES } from "@/data/categories";
import { clearHistory, getHistory, HISTORY_EVENT, type HistoryItem } from "@/lib/history";

const PILL = {
  green: "bg-green-500/15 text-green-400",
  amber: "bg-amber-500/15 text-amber-400",
  red: "bg-red-500/15 text-red-400",
} as const;

export default function RecentProducts() {
  // İlk render boş: SSR ile birebir aynı, hydration uyuşmazlığı olmaz
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const sync = () => setItems(getHistory());
    sync();
    window.addEventListener(HISTORY_EVENT, sync);
    window.addEventListener("storage", sync); // diğer sekmeler
    return () => {
      window.removeEventListener(HISTORY_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section aria-label="Son İncelenenler" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Son İncelenenler</h2>
        <button onClick={clearHistory} aria-label="Geçmişi Temizle" title="Geçmişi Temizle" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        {items.map((h) => {
          const cat = CATEGORIES.find((c) => c.id === h.category)!;
          return (
            <li key={h.barcode} className="w-56 shrink-0 snap-start">
              <Link href={`/product/${h.barcode}?c=${h.category}`} className="flex h-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 transition hover:border-cyan-400">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-800">
                  {h.imageUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={h.imageUrl} alt="" className="h-full w-full object-contain" /> : <cat.Icon className="h-6 w-6 text-slate-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] uppercase tracking-wider text-slate-500">{h.brand}</p>
                  <p className="truncate text-sm font-semibold">{h.name}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${PILL[h.band]}`}>{h.score}</span>
                    <span className="truncate text-[10px] text-violet-300">{cat.label}</span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

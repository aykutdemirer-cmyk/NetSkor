"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, Search, Star } from "lucide-react";
import type { Review, ReviewSource } from "@/types";
import { normTr as norm } from "@/lib/text";

const SOURCES: { id: ReviewSource | "all"; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "google", label: "Google Reviews" },
  { id: "trendyol", label: "Trendyol" },
  { id: "hepsiburada", label: "Hepsiburada" },
  { id: "amazon_tr", label: "Amazon TR" },
  { id: "forum", label: "Forum" },
];
const SOURCE_LABEL = Object.fromEntries(SOURCES.map((s) => [s.id, s.label]));

export default function ReviewList({ reviews }: { reviews: Review[] }) {
  const [source, setSource] = useState<ReviewSource | "all">("all");
  const [q, setQ] = useState("");

  const visible = useMemo(() => {
    const nq = norm(q.trim());
    return reviews.filter(
      (r) => (source === "all" || r.source === source) && (!nq || norm(`${r.text} ${r.profile ?? ""} ${r.flags.map((f) => f.label).join(" ")}`).includes(nq)),
    );
  }, [reviews, source, q]);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Yorumlar ({visible.length})</h2>
      <div className="flex flex-wrap gap-2">
        {SOURCES.map((s) => (
          <button
            key={s.id}
            onClick={() => setSource(s.id)}
            aria-pressed={source === s.id}
            className={`rounded-full border px-3 py-1.5 text-xs ${source === s.id ? "border-cyan-400 bg-cyan-400/10 text-cyan-300" : "border-slate-700 text-slate-400"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 focus-within:border-cyan-400">
        <Search className="h-4 w-4 text-slate-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Yorumlarda ara: pişik, koku, alerji…"
          className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-600" />
      </div>

      {visible.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Eşleşen yorum yok.</p>}
      {visible.map((r) => (
        <article key={r.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-2 font-semibold text-slate-200">
              {r.author}
              {r.verifiedBuyer && <span className="flex items-center gap-1 font-normal text-green-400"><BadgeCheck className="h-3.5 w-3.5" />Doğrulanmış Alıcı</span>}
            </span>
            <span>{SOURCE_LABEL[r.source]}</span>
          </div>
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className="flex">{Array.from({ length: 5 }, (_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-700"}`} />)}</span>
            {r.profile && <span className="text-violet-300">✓ {r.profile}</span>}
          </div>
          <p className="text-sm text-slate-200">{r.text}</p>
          {r.flags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {r.flags.map((f) => (
                <span key={f.label} className={`rounded-full px-2.5 py-1 text-xs ${f.kind === "risk" ? "bg-red-500/15 text-red-300" : "bg-green-500/15 text-green-300"}`}>
                  {f.kind === "risk" ? "⚠️" : "✓"} {f.label}
                </span>
              ))}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

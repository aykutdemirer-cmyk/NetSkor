import Link from "next/link";
import { FlaskConical, MessageSquare, Zap, ThumbsUp, ThumbsDown, Users } from "lucide-react";
import { calculateScore } from "@/lib/scoring";
import type { ProductAnalysis, ScoreBand } from "@/types";

const BAND: Record<ScoreBand, { text: string; bg: string; ring: string; label: string }> = {
  green: { text: "text-green-400", bg: "bg-green-500", ring: "border-green-500", label: "Güvenli" },
  amber: { text: "text-amber-400", bg: "bg-amber-500", ring: "border-amber-500", label: "Dikkatli Kullan" },
  red: { text: "text-red-400", bg: "bg-red-500", ring: "border-red-500", label: "Riskli" },
};

const Bar = ({ icon, label, value, estimated }: { icon: React.ReactNode; label: string; value: number; estimated?: boolean }) => {
  if (estimated)
    return (
      <div>
        <div className="mb-1 flex justify-between text-sm text-slate-500">
          <span className="flex items-center gap-2">{icon} {label}</span><span>Veri yok</span>
        </div>
        <div className="h-2 rounded-full bg-slate-800" />
      </div>
    );
  const b = BAND[value >= 90 ? "green" : value >= 70 ? "amber" : "red"];
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="flex items-center gap-2">{icon} {label}</span>
        <span className={`font-semibold ${b.text}`}>{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${b.bg}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
};

export default function ScoreCard({ data }: { data: ProductAnalysis }) {
  const { product: p } = data;
  const score = calculateScore(p.category, data.inputs);
  const band = BAND[score.band];
  const est = data.estimated;
  const missing = [est?.ingredients && "içerik", est?.reviews && "yorum", est?.value && "fiyat"].filter(Boolean);
  const reviewPart = score.parts.find((x) => x.key === "reviews")!.score; // skor motoruyla aynı değer

  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-800 text-4xl">
          {p.imageUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.imageUrl} alt={p.name} className="h-full w-full object-contain" /> : data.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-slate-500">{p.brand} · {data.ageGroup}</p>
          <h1 className="text-lg font-bold leading-tight">{p.name}</h1>
          <p className="text-xs text-slate-500">Barkod: {p.barcode}{p.priceTry > 0 && ` · ~${Math.round(p.priceTry)} TL`}</p>
        </div>
        <div className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-4 ${band.ring}`}>
          <span className={`text-2xl font-extrabold ${band.text}`}>{score.total}</span>
          <span className="text-[10px] text-slate-400">/100</span>
        </div>
      </div>
      <p className={`text-sm font-semibold ${band.text}`}>● {band.label}</p>

      {missing.length > 0 && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Skor tahminidir: {missing.join(", ")} verisi bulunamadı ve nötr değer (70) kullanıldı.
        </p>
      )}
      <div className="flex flex-col gap-3">
        <Bar icon={<FlaskConical className="h-4 w-4" />} label="İçerik Güvenliği" value={data.inputs.ingredientSafety} estimated={data.estimated?.ingredients} />
        <Bar icon={<MessageSquare className="h-4 w-4" />} label="Kullanıcı Yorum Skoru" value={reviewPart} estimated={data.estimated?.reviews} />
        <Bar icon={<Zap className="h-4 w-4" />} label="Fiyat & Performans" value={data.inputs.valueForMoney} estimated={data.estimated?.value} />
      </div>

      <div className="rounded-2xl bg-slate-800/60 p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" /> Kimler Kullanıyor?</h3>
        <div className="flex flex-wrap gap-2">
          {data.audience.map((a) => (
            <span key={a} className="rounded-full bg-violet-500/15 px-3 py-1 text-xs text-violet-300">{a}</span>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 empty:hidden">
        {data.pros.length > 0 && <ul className="space-y-2 rounded-2xl bg-green-500/10 p-4 text-sm">
          {data.pros.map((t) => <li key={t} className="flex gap-2"><ThumbsUp className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />{t}</li>)}
        </ul>}
        {data.cons.length > 0 && <ul className="space-y-2 rounded-2xl bg-red-500/10 p-4 text-sm">
          {data.cons.map((t) => <li key={t} className="flex gap-2"><ThumbsDown className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />{t}</li>)}
        </ul>}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/" className="rounded-xl border border-slate-700 px-4 py-2 text-sm">← Yeni Ürün Tara</Link>
        {/* Katman 4: /compare?a=<barkod> */}
        <Link href={`/compare?a=${p.barcode}&c=${p.category}`} className="rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white">
          VS Başka Ürünle Karşılaştır
        </Link>
      </div>
    </section>
  );
}

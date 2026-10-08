import Link from "next/link";
import { isPersistent } from "@/lib/cache";
import { CATEGORIES } from "@/data/categories";
import { submitContribution } from "./actions";

const field = "w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm outline-none focus:border-cyan-400";

export default function ContributePage({ searchParams }: { searchParams: { barcode?: string; c?: string; error?: string } }) {
  const enabled = isPersistent();
  const barcode = (searchParams.barcode ?? "").replace(/\D/g, "").slice(0, 14);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 px-4 py-8">
      <Link href="/" className="text-sm text-slate-400">← Ana Sayfa</Link>
      <h1 className="text-xl font-bold">Ürün Ekle</h1>
      <p className="text-sm text-slate-400">Bulunamayan ürünü ekleyin. Bilgiler “doğrulanmamış” olarak işaretlenir. İçerik listesini ambalajdan olduğu gibi yazın.</p>

      {!enabled && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-300">Katkı özelliği şu an kapalı: kalıcı depolama (Upstash Redis) bağlı değil.</p>
      )}
      {searchParams.error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{searchParams.error}</p>}

      <form action={submitContribution} className="flex flex-col gap-3">
        <input name="barcode" defaultValue={barcode} placeholder="Barkod (8-14 hane)" inputMode="numeric" required className={field} />
        <input name="name" placeholder="Ürün adı" required maxLength={120} className={field} />
        <input name="brand" placeholder="Marka" maxLength={60} className={field} />
        <select name="category" defaultValue={searchParams.c ?? "baby"} className={field}>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <textarea name="ingredients" placeholder="İçindekiler (ambalajdaki gibi, virgülle ayrılmış)" rows={5} maxLength={2000} className={field} />
        {/* Honeypot: insanlar görmez */}
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <button disabled={!enabled} className="rounded-xl bg-violet-600 py-2.5 text-sm font-semibold disabled:opacity-40">Kaydet</button>
      </form>
    </main>
  );
}

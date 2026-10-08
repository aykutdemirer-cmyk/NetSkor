import { cacheGet, cacheSet, isPersistent } from "@/lib/cache";
import type { LookupResult } from "@/lib/api/productLookup";
import type { Category } from "@/types";

export interface Contribution {
  barcode: string;
  name: string;
  brand: string;
  category: Category;
  ingredients: string;
}

const CATEGORIES: Category[] = ["baby", "cosmetics", "food", "cleaning"];
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** Form girdisini doğrular ve temizler. Hata varsa errors dolu döner. */
export function validateContribution(raw: Record<string, unknown>): { ok: true; value: Contribution } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (clean(raw.website, 100)) errors.push("spam"); // honeypot: botlar doldurur, insanlar görmez
  const barcode = clean(raw.barcode, 20);
  if (!/^\d{8,14}$/.test(barcode)) errors.push("Barkod 8-14 haneli rakam olmalı.");
  const name = clean(raw.name, 120);
  if (name.length < 2) errors.push("Ürün adı en az 2 karakter olmalı.");
  const category = CATEGORIES.find((c) => c === raw.category);
  if (!category) errors.push("Kategori seçin.");
  const ingredients = clean(raw.ingredients, 2000);
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { barcode, name, brand: clean(raw.brand, 60), category: category!, ingredients } };
}

type Env = Record<string, string | undefined>;
const key = (barcode: string) => `contrib:v1:${barcode}`;

export async function saveContribution(c: Contribution, env?: Env, f?: typeof fetch): Promise<boolean> {
  if (!isPersistent(env)) return false; // kalıcı depolama yoksa kayıt yapılmaz (geçici bellek yanıltıcı olur)
  return cacheSet(key(c.barcode), c, undefined, env, f);
}

/** Kullanıcı katkısını arama/analiz hattının anladığı biçime çevirir. */
export async function getContribution(barcode: string, env?: Env, f?: typeof fetch): Promise<LookupResult | null> {
  const c = await cacheGet<Contribution>(key(barcode), env, f);
  if (!c) return null;
  return { barcode: c.barcode, name: c.name, brand: c.brand, ingredientsText: c.ingredients || undefined, analysisTags: [], source: "user", category: c.category };
}

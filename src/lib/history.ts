import type { Category, ScoreBand } from "@/types";

export interface HistoryItem {
  barcode: string;
  name: string;
  brand: string;
  imageUrl?: string;
  category: Category;
  score: number;
  band: ScoreBand;
}

const KEY = "netskor:history:v1";
export const HISTORY_EVENT = "netskor:history";
export const MAX_HISTORY = 10;

// SSR'de window yok; gizli modda/kota dolu iken erişim throw eder -> hepsi sessizce yutulur
function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage ?? null;
  } catch {
    return null;
  }
}

const valid = (x: any): x is HistoryItem =>
  !!x && typeof x.barcode === "string" && typeof x.name === "string" && typeof x.score === "number" && ["green", "amber", "red"].includes(x.band);

export function getHistory(): HistoryItem[] {
  try {
    const raw = store()?.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(valid).slice(0, MAX_HISTORY) : [];
  } catch {
    return []; // bozuk JSON
  }
}

function write(list: HistoryItem[]) {
  try {
    const s = store();
    if (!s) return;
    list.length ? s.setItem(KEY, JSON.stringify(list)) : s.removeItem(KEY);
    window.dispatchEvent(new Event(HISTORY_EVENT)); // aynı sekmedeki dinleyiciler için
  } catch {
    /* kota/erişim hatası: geçmiş opsiyonel */
  }
}

/** Başa ekler; aynı barkod varsa eskisini silip en üste taşır; en fazla 10 kayıt. */
export function addToHistory(item: HistoryItem): void {
  if (!item.barcode) return;
  write([item, ...getHistory().filter((h) => h.barcode !== item.barcode)].slice(0, MAX_HISTORY));
}

export function clearHistory(): void {
  write([]);
}

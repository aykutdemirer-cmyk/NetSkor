import { Baby, Sparkles, Cookie, SprayCan, type LucideIcon } from "lucide-react";
import type { Category } from "@/types";

export interface CategoryMeta {
  id: Category;
  label: string;
  hint: string;
  scanHint: string;
  Icon: LucideIcon;
}

// Sıra önemli: Bebek & Çocuk ilk ve varsayılan
export const CATEGORIES: CategoryMeta[] = [
  {
    id: "baby",
    label: "Bebek & Çocuk",
    hint: "Mama, pişik kremi, bez, şampuan",
    scanHint: "Bebek cildi hassasiyeti, ebeveyn onay oranı ve pediatrik şikayetler taranır.",
    Icon: Baby,
  },
  {
    id: "cosmetics",
    label: "Kozmetik & Cilt Bakımı",
    hint: "Serum, nemlendirici, saç, güneş kremi",
    scanHint: "İçerik, komedojenik risk ve kullanıcı memnuniyeti taranır.",
    Icon: Sparkles,
  },
  {
    id: "food",
    label: "Gıda & Atıştırmalık",
    hint: "Bisküvi, çikolata, içecek, hazır gıda",
    scanHint: "Şeker, palm yağı, E kodlu katkılar ve lezzet puanı taranır.",
    Icon: Cookie,
  },
  {
    id: "cleaning",
    label: "Temizlik & Hijyen",
    hint: "Deterjan, ıslak mendil, sabun",
    scanHint: "Tahriş edici içerikler ve kullanıcı deneyimi taranır.",
    Icon: SprayCan,
  },
];

export const DEFAULT_CATEGORY: Category = "baby";

export interface DemoProduct {
  emoji: string;
  label: string;
  barcode: string;
}

export const BABY_DEMOS: DemoProduct[] = [
  { emoji: "🍼", label: "Sudocrem 125g Tara", barcode: "5011091104752" },
  { emoji: "🐥", label: "Dalin Şampuan 700ml Tara", barcode: "8690605061158" },
  { emoji: "🌿", label: "Mustela Gentle Cleansing 500ml Tara", barcode: "3504105035600" },
];


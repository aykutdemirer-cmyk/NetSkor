export type Category = "baby" | "cosmetics" | "food" | "cleaning";
export type ReviewSource = "google" | "trendyol" | "hepsiburada" | "amazon_tr" | "forum";
export type ScoreBand = "green" | "amber" | "red";

export interface Product {
  barcode: string; // EAN-13 / UPC
  name: string;
  brand: string;
  category: Category;
  imageUrl?: string;
  ingredients: string[]; // INCI / katkı listesi
  priceTry: number;
  netAmount: number; // g veya ml
  unit: "g" | "ml" | "adet";
}

export interface Review {
  id: string;
  source: ReviewSource;
  author: string;
  verifiedBuyer: boolean;
  profile?: string; // örn. "Kuru & Hassas Cilt"
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  flags: ReviewFlag[];
}

export interface ReviewFlag {
  kind: "risk" | "positive";
  label: string; // örn. "Alerji Riski"
}

// Skorlayıcıya girecek, 0-100 normalize edilmiş ham sinyaller
export interface ScoreInputs {
  ingredientSafety: number; // içerik güvenliği / temizlik
  reviewSatisfaction: number; // yorum memnuniyeti (yıldız bazlı)
  complaintRate?: number; // 0-1, kronik şikayet oranı (bebek)
  certification?: number; // pediatrik onay & doğallık (bebek)
  valueForMoney: number; // fiyat / performans / erişilebilirlik
}

export interface ScoreBreakdown {
  total: number;
  band: ScoreBand;
  parts: { key: string; label: string; weight: number; score: number }[];
}

export interface ProductAnalysis {
  product: Product;
  emoji: string;
  ageGroup: string;
  audience: string[]; // "Kimler Kullanıyor?"
  pros: string[];
  cons: string[];
  inputs: ScoreInputs;
  unitPrice?: string; // örn. "4,2 TL / bez"
  claims?: string[]; // üretici beyanları (parfümsüz, klor içermez...)
  productSource?: "openfacts" | "web" | "user"; // web: ad/içerik internet aramasından çıkarıldı, doğrulanmadı
  reviewMode?: "live" | "demo"; // demo: yorum/fiyat deterministik örnek veri
  estimated?: { reviews: boolean; value: boolean; ingredients: boolean }; // gerçek veri yoksa nötr değer kullanıldı
  noSting: number; // göz yakmama (0-100)
  reviews: Review[];
}

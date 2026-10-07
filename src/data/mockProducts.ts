import type { ProductAnalysis } from "@/types";

export const MOCK_PRODUCTS: Record<string, ProductAnalysis> = {
  "5011091104752": {
    emoji: "🍼",
    ageGroup: "0+ ay",
    product: {
      barcode: "5011091104752", name: "Sudocrem Antiseptik Pişik Kremi 125g", brand: "Sudocrem",
      category: "baby", ingredients: ["Zinc Oxide", "Lanolin", "Benzyl Alcohol", "Benzyl Benzoate", "Benzyl Cinnamate"],
      priceTry: 289, netAmount: 125, unit: "g",
    },
    audience: ["0-6 Ay Yenidoğan", "Pişik Eğilimli Bebekler", "Bez Bölgesi Tahrişi"],
    pros: ["Pişikte hızlı iyileşme ve koruyucu bariyer", "Çinko oksit bazlı, yaygın pediatrik tavsiye"],
    cons: ["Lanolin ve benzil türevleri: hassas bebeklerde alerji riski", "Yoğun yapı; sürekli genel nemlendirici olarak uygun değil"],
    inputs: { ingredientSafety: 78, reviewSatisfaction: 92, complaintRate: 0.08, certification: 80, valueForMoney: 74 },
    reviews: [
      { id: "s1", source: "trendyol", author: "an***a", verifiedBuyer: true, profile: "4 Aylık Bebek Annesi", rating: 5,
        text: "İki günde pişik tamamen geçti, ince sürünce yeterli.", flags: [{ kind: "positive", label: "Hızlı İyileşme" }] },
      { id: "s2", source: "hepsiburada", author: "me***t", verifiedBuyer: true, profile: "9 Aylık Bebek Babası", rating: 4,
        text: "Çok yoğun, sadece pişikte kullanın. Koku hafif ama var.", flags: [{ kind: "risk", label: "Yoğun Yapı / Sadece Pişikte Kullanın" }] },
      { id: "s3", source: "google", author: "Zeynep K.", verifiedBuyer: false, profile: "Hassas Ciltli Bebek", rating: 2,
        text: "Bebeğimde kızarıklık yaptı, lanolin alerjisi olabilir.", flags: [{ kind: "risk", label: "Alerji Riski" }] },
    ],
  },
  "8690605061158": {
    emoji: "🐥",
    ageGroup: "0+ ay",
    product: {
      barcode: "8690605061158", name: "Dalin Bebek Şampuanı 700ml", brand: "Dalin",
      category: "baby", ingredients: ["Aqua", "Sodium Laureth Sulfate", "Cocamidopropyl Betaine", "Parfum", "Phenoxyethanol"],
      priceTry: 139, netAmount: 700, unit: "ml",
    },
    audience: ["0-6 Ay Yenidoğan", "Günlük Banyo", "Bütçe Odaklı Aileler"],
    pros: ["Gözü yakmayan formül, bol köpük", "Litre başına çok uygun fiyat"],
    cons: ["SLES, parfüm ve fenoksietanol içerir", "Çok hassas ciltlerde kuruluk şikayeti"],
    inputs: { ingredientSafety: 58, reviewSatisfaction: 85, complaintRate: 0.12, certification: 55, valueForMoney: 95 },
    reviews: [
      { id: "d1", source: "amazon_tr", author: "Ca***", verifiedBuyer: true, profile: "6 Aylık Bebek Annesi", rating: 5,
        text: "Gözünü yakmıyor, kokusu güzel, 700ml uzun gidiyor.", flags: [{ kind: "positive", label: "Göz Yakmaz" }] },
      { id: "d2", source: "trendyol", author: "se***n", verifiedBuyer: true, profile: "Kuru & Hassas Cilt", rating: 2,
        text: "Parfümlü, bebeğin sırtında kuruluk ve kaşıntı yaptı.", flags: [{ kind: "risk", label: "Alerji Riski" }] },
    ],
  },
  "3504105035600": {
    emoji: "🌿",
    ageGroup: "0+ ay",
    product: {
      barcode: "3504105035600", name: "Mustela Gentle Cleansing Gel 500ml", brand: "Mustela",
      category: "baby", ingredients: ["Aqua", "Coco-Glucoside", "Glycerin", "Persea Gratissima (Avocado) Extract"],
      priceTry: 649, netAmount: 500, unit: "ml",
    },
    audience: ["0-6 Ay Yenidoğan", "Atopiye Eğilimli Cilt", "Saç & Vücut Tek Ürün"],
    pros: ["Sülfatsız, parabensiz; dermatolojik testli", "Avokado özlü, cildi kurutmaz"],
    cons: ["Yüksek fiyat (ml başına ~2.4x Dalin)", "Köpük az; tüketim hızlı olabilir"],
    inputs: { ingredientSafety: 95, reviewSatisfaction: 91, complaintRate: 0.04, certification: 92, valueForMoney: 48 },
    reviews: [
      { id: "m1", source: "hepsiburada", author: "el***f", verifiedBuyer: true, profile: "Atopik Dermatitli Bebek", rating: 5,
        text: "Egzamalı bebeğimde tahriş yapmadı, kuruluk yok.", flags: [{ kind: "positive", label: "Hassas Cilde Uygun" }] },
      { id: "m2", source: "google", author: "Burak T.", verifiedBuyer: false, profile: "3 Aylık Bebek Babası", rating: 3,
        text: "İyi ama çok pahalı, köpürmüyor gibi hissettiriyor.", flags: [] },
    ],
  },
};

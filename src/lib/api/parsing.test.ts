import { describe, expect, it } from "vitest";
import { estimateUnitPrice, extractPriceMentions, selectPrices } from "@/lib/scoring/priceEstimator";
import { isFirstPersonExperience, isPromotional } from "@/lib/scoring/reviewAnalyzer";
import { isReviewLike } from "./reviewSearch";

describe("fiyat anomali filtresi (Molfix 36'lı)", () => {
  it("adet başı 15 TL üstü (koli/hatalı snippet) medyandan dışlanır", () => {
    // 1500 TL / 36 = 41,7 TL/bez -> elenir; 151,5 TL / 36 = 4,2 TL/bez -> kalır
    const e = estimateUnitPrice([1500, 151.5, 5000, 180], 36, "bez");
    expect(e?.medianPrice).toBe(165.75); // 151,5 ve 180'in medyanı
    expect(e!.priceScore).toBeGreaterThan(70);
    expect(estimateUnitPrice([1500], 36, "bez")).toBeNull(); // yalnızca sapma varsa güvenilir fiyat yok
    expect(estimateUnitPrice([40], 36, "bez")).toBeNull(); // adet başı 1,1 TL: eksik/hatalı sayı
  });

  it("mendilde de adet başı sınır var", () => {
    expect(estimateUnitPrice([60], 90, "mendil")).not.toBeNull(); // 0,67 TL
    expect(estimateUnitPrice([900], 90, "mendil")).toBeNull(); // 10 TL/mendil
  });

  it("fiyat bağlamı: etiketli, 'en ucuz' ve koli ayrımı", () => {
    const m = extractPriceMentions("Fiyat : ₺151,50 (KDV Dahil). En ucuz 99 TL'den başlayan fiyatlarla");
    expect(m[0]).toMatchObject({ value: 151.5, labeled: true, cheapest: false });
    expect(m[1]).toMatchObject({ value: 99, cheapest: true });
  });

  it("selectPrices: ürün başlığıyla eşleşen etiketli tekil fiyat önceliklidir", () => {
    const name = "Molfix 3D Eko Paket Mini 36Lı Bebek Bezi";
    const hits = [
      { title: "Molfix 3D Eko Paket Mini 36'lı Bebek Bezi", snippet: "Barkod 8690536821129. Fiyat : ₺151,50" },
      { title: "Molfix Bebek Bezi 4'lü Koli 144 adet", snippet: "Koli fiyatı 1.499,90 TL" }, // koli
      { title: "Alakasız Şampuan Kampanyası", snippet: "Fiyat : 89 TL" }, // başlık uyuşmuyor
      { title: "Bebek Bezleri", snippet: "En ucuz 99 TL'den başlayan fiyatlar" }, // en ucuz
    ];
    expect(selectPrices(hits, name)).toEqual([151.5]);
    // eşleşen etiketli yoksa eşleşen etiketsize, o da yoksa genele düşer
    expect(selectPrices([{ title: "Molfix Bebek Bezi Mini 36'lı", snippet: "yaklaşık 160 TL" }], name)).toEqual([160]);
    expect(selectPrices([{ title: "Başka Ürün", snippet: "120 TL" }], name)).toEqual([120]);
  });
});

describe("tanıtım metni ve gerçek yorum ayrımı (Hepsiburada)", () => {
  const promo = [
    "Yerli üretim kalitesiyle öne çıkan bebek bezi, bebeğinizin cildine uygun.",
    "Bezin 5 yönden esnek yapısı sayesinde bebeğiniz rahat hareket eder.",
    "Gelişmiş emici teknolojisi ile uzun süre kuru kalmasını sağlar.",
    "Annelerin tercihidir; sunan yapısıyla gün boyu konfor.",
  ];
  const real = [
    "Bebeğime aldık, pişik yaptı, bir daha almayacağız.",
    "3 aydır kullanıyoruz, çok memnun kaldık, sızdırmıyor.",
    "Bez sızdırıyor, gece uyandırdı.",
    "Bu markayı denedim, bebeğimde alerji yapmadı.",
  ];
  it("pazarlama kalıpları tanıtım sayılır", () => promo.forEach((t) => expect(isPromotional(t)).toBe(true)));
  it("tanıtım metinlerinde birinci şahıs/deneyim yoktur; gerçek yorumlar tanıtım değildir", () => {
    promo.forEach((t) => expect(isFirstPersonExperience(t)).toBe(false));
    real.forEach((t) => { expect(isPromotional(t)).toBe(false); expect(isFirstPersonExperience(t)).toBe(true); });
  });
  it("yorum olmayan sayfa metinleri hâlâ elenir", () => expect(isReviewLike("Bu sayfada bilgi yok.")).toBe(false));
});

describe("deneyim tespiti isimlerle karışmaz", () => {
  it("'üretim', 'plastik', 'estetik' gibi -tim/-tik biten isimler birinci şahıs sayılmaz", () => {
    for (const t of ["Yerli üretim bebek bezi", "Plastik ambalajlı estetik tasarım", "Elektrik gerektirmez, konfor sağlar"]) expect(isFirstPersonExperience(t)).toBe(false);
    expect(isFirstPersonExperience("Bebeğime aldık")).toBe(true);
    expect(isFirstPersonExperience("Çok memnun kaldık")).toBe(true);
  });
});

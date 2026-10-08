import { beforeEach, describe, expect, it, vi } from "vitest";
import { configuredProviders, searchWeb, _resetProviders } from "./searchProviders";
import { searchReviews } from "./reviewSearch";
import { webLookupProduct } from "./webLookup";

beforeEach(() => _resetProviders());

const ok = (body: object) => new Response(JSON.stringify(body));
const serpapiBody = { organic_results: [{ title: "SerpAPI sonucu", link: "https://www.trendyol.com/a", snippet: "uygun fiyat 120 TL" }] };
const serperBody = { organic: [{ title: "Serper sonucu", link: "https://www.hepsiburada.com/b", snippet: "Çok güzel koku var, bebeğimde sorun yaşamadık, memnunuz" }] };
const braveBody = { web: { results: [{ title: "Brave sonucu", url: "https://www.amazon.com.tr/c", description: "<strong>etkili</strong> ürün" }] } };

describe("configuredProviders", () => {
  it("sıra: serpapi, serper, brave, google; yalnızca tanımlılar", () => {
    expect(configuredProviders({})).toEqual([]);
    expect(configuredProviders({ BRAVE_SEARCH_API_KEY: "b", SERPAPI_KEY: "s", GOOGLE_SEARCH_API_KEY: "g" })).toEqual(["serpapi", "brave"]); // google CX olmadan eklenmez
    expect(configuredProviders({ SERPAPI_KEY: "s", SERPER_API_KEY: "x", BRAVE_SEARCH_API_KEY: "b", GOOGLE_SEARCH_API_KEY: "g", GOOGLE_SEARCH_CX: "c" })).toEqual(["serpapi", "serper", "brave", "google"]);
  });
});

describe("searchWeb yedek zinciri", () => {
  const env = { SERPAPI_KEY: "s", SERPER_API_KEY: "x", BRAVE_SEARCH_API_KEY: "b" };
  const route = (u: string) => (u.includes("serpapi") ? "serpapi" : u.includes("serper") ? "serper" : "brave");

  it("SerpAPI kotası (429) bitince Serper'e geçer; sonraki isteklerde SerpAPI atlanır", async () => {
    const f = vi.fn(async (u: string) => (route(u) === "serpapi" ? new Response("", { status: 429 }) : ok(serperBody))) as unknown as typeof fetch;
    const r1 = await searchWeb("q", env, f);
    expect(r1?.provider).toBe("serper");
    expect(r1?.hits[0].title).toBe("Serper sonucu");
    const before = (f as unknown as { mock: { calls: string[][] } }).mock.calls.filter((c) => c[0].includes("serpapi")).length;
    await searchWeb("q2", env, f);
    const after = (f as unknown as { mock: { calls: string[][] } }).mock.calls.filter((c) => c[0].includes("serpapi")).length;
    expect(after).toBe(before); // cooldown: tekrar denenmedi
  });

  it("ağ hatası: cooldown olmadan sıradakine geçer; Brave HTML etiketlerini temizler", async () => {
    const f = vi.fn(async (u: string) => { if (route(u) === "brave") return ok(braveBody); throw new Error("net"); }) as unknown as typeof fetch;
    const r = await searchWeb("q", env, f);
    expect(r?.provider).toBe("brave");
    expect(r?.hits[0]).toMatchObject({ snippet: "etkili ürün", link: "https://www.amazon.com.tr/c" });
  });

  it("hepsi başarısız veya anahtar yok -> null", async () => {
    const f = vi.fn(async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    expect(await searchWeb("q", env, f)).toBeNull();
    expect(await searchWeb("q", {}, f)).toBeNull();
  });
});

describe("entegrasyon", () => {
  it("searchReviews: SerpAPI düşünce Serper ile canlı sonuç", async () => {
    const f = vi.fn(async (u: string) => (u.includes("serpapi") ? new Response("", { status: 429 }) : ok(serperBody))) as unknown as typeof fetch;
    const r = await searchReviews({ productName: "Krem", brand: "M", category: "baby" }, "1", f, { SERPAPI_KEY: "s", SERPER_API_KEY: "x" });
    expect(r.mode).toBe("live");
    expect(r.reviews[0].source).toBe("hepsiburada");
  });
  it("searchReviews: tüm sağlayıcılar düşerse demo", async () => {
    const f = vi.fn(async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    expect((await searchReviews({ productName: "Krem", brand: "M", category: "baby" }, "1", f, { SERPAPI_KEY: "s", SERPER_API_KEY: "x" })).mode).toBe("demo");
  });
  it("webLookup: SerpAPI yoksa Brave ile ürün adı ve fiyat bulunur", async () => {
    const f = vi.fn(async (u: string) => ok(u.includes("brave")
      ? { web: { results: [
          { title: "Sarelle Kakaolu Fındık Ezmesi 350 g - Migros", url: "https://migros.com.tr/a", description: "120 TL. İçindekiler: Şeker, palm yağı, fındık, kakao, emülgatör." },
          { title: "Sarelle Kakaolu Fındık Ezmesi 350g | A101", url: "https://a101.com.tr/b", description: "115 TL" },
          { title: "Sarelle Fındık Ezmesi Kakaolu 350 g", url: "https://x.com/c", description: "" },
        ] } }
      : {})) as unknown as typeof fetch;
    const r = await webLookupProduct("8690000000099", "food", f, { BRAVE_SEARCH_API_KEY: "b" });
    expect(r?.name).toContain("Sarelle");
    expect(r?.prices).toEqual([120, 115]);
    expect(r?.ingredientsText).toContain("palm yağı");
  });
});

describe("webLookup doğrulama ve tanılama", () => {
  const brave = (results: { title: string; url: string; description: string }[]) =>
    vi.fn(async () => new Response(JSON.stringify({ web: { results } }))) as unknown as typeof fetch;
  const env = { BRAVE_SEARCH_API_KEY: "b" };

  it("barkodu içeren sonuçlar güvenilir sayılır; izleme adımları kaydedilir", async () => {
    const f = brave([
      { title: "Ürün X 250 ml - Site A", url: "https://a.com/p/8690536821129", description: "Barkod 8690536821129" },
      { title: "Ürün X 250 ml Fiyatı | Site B", url: "https://b.com/x", description: "EAN: 8690536821129. 89 TL" },
      { title: "Alakasız Sayfa Başlığı", url: "https://c.com", description: "başka şey" },
    ]);
    const trace: import("./webLookup").TraceStep[] = [];
    const r = await webLookupProduct("8690536821129", "baby", f, env, trace);
    expect(r?.name).toContain("Ürün X");
    expect(r?.prices).toEqual([89]); // yalnızca güvenilir sonuçlardan
    expect(trace[0]).toMatchObject({ via: "brave", count: 3 });
  });

  it("barkodsuz ve birbirine uymayan sonuçlar reddedilir (yanlış ürün riski)", async () => {
    const f = brave([
      { title: "Çikolata Gofret Tanıtım", url: "https://a.com", description: "x" },
      { title: "Bahçe Hortumu Modelleri", url: "https://b.com", description: "y" },
      { title: "Laptop Çantası İncele", url: "https://c.com", description: "z" },
    ]);
    expect(await webLookupProduct("8690536821129", "baby", f, env)).toBeNull();
  });

  it("barkodsuz ama birbirine benzeyen başlıklar kabul edilir", async () => {
    const f = brave([
      { title: "Sarelle Kakaolu Fındık Ezmesi 350 g", url: "https://a.com", description: "" },
      { title: "Sarelle Kakaolu Fındık Ezmesi 350g", url: "https://b.com", description: "" },
      { title: "Sarelle Fındık Ezmesi Kakaolu 350 g", url: "https://c.com", description: "" },
    ]);
    expect((await webLookupProduct("8690536821129", "food", f, env))?.name).toContain("Sarelle");
  });
});

describe("gerçek Google sonucu: Molfix 8690536821129", () => {
  it("başlıktan barkod temizlenir, ₺ öneki fiyat okunur, kategori bebek", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ web: { results: [
      { title: "Molfix Bebek Bezi Jumbo 2 Mini 36'lı 8690536821129", url: "https://www.toptantr.com/molfix", description: "Bebem natural'in emici bölgesinde kullanılan doğal bambu" },
      { title: "Molfix Bantlı Bebek Bezi 2 Numara 36 Adet Jumbo Paket", url: "https://www.asyasanalmarket.com/molfix", description: "Barkod : 8690536821129. Sepetteki Son Fiyat. Fiyat : ₺151,50(KDV Dahil). Sepet Fiyatı : ADET" },
    ] } }))) as unknown as typeof fetch;
    const { enrichProduct } = await import("./enrichProduct");
    const { _clearMemoryCache } = await import("@/lib/cache");
    _clearMemoryCache();
    const r = await webLookupProduct("8690536821129", "food", f, { BRAVE_SEARCH_API_KEY: "b" });
    expect(r?.name).not.toMatch(/\d{8,}/);
    expect(r?.name).toContain("Molfix");
    expect(r?.prices).toEqual([151.5]);
    // yalnızca web bulursa: bulunamayan Open Facts + web -> bebek bezi bebek kategorisinde
    const miss = vi.fn(async (u: string) => (u.includes("openfoodfacts") || u.includes("openbeautyfacts") ? new Response(JSON.stringify({ status: 0 })) : (f as unknown as (u: string) => Promise<Response>)(u))) as unknown as typeof fetch;
    const full = await enrichProduct("8690536821129", "food", miss, { BRAVE_SEARCH_API_KEY: "b" });
    expect(full?.product.category).toBe("baby");
    expect(full?.productSource).toBe("web");
  });
});

describe("Molfix regresyonları", () => {
  const brave = (results: { title: string; url: string; description: string }[]) =>
    vi.fn(async () => new Response(JSON.stringify({ web: { results } }))) as unknown as typeof fetch;

  it("Türkçe kaynak tercih edilir; '3-6 kg' aralığı gramaj sayılmaz", async () => {
    const f = brave([
      { title: 'Molfix Çaga arlygy "2 mini" 3-6 kg 36 sany 8690536821129', url: "https://kz-market.kz/p", description: "8690536821129" },
      { title: "Molfix Bebek Bezi Jumbo 2 Mini 3-6 kg 36'lı 8690536821129", url: "https://www.toptantr.com.tr/m", description: "doğal bambu 8690536821129" },
    ]);
    const r = await webLookupProduct("8690536821129", "baby", f, { BRAVE_SEARCH_API_KEY: "b" });
    expect(r?.name).toContain("Bebek Bezi");
    expect(r?.name).not.toContain("sany");
    expect(r?.quantity).toBeUndefined();
  });

  it("yorum sorgusunda marka tekrarlanmaz; sonuç yoksa kısa sorguyla yeniden denenir", async () => {
    const urls: string[] = [];
    const f = vi.fn(async (u: string) => {
      urls.push(decodeURIComponent(u));
      const short = decodeURIComponent(u).includes("Molfix Bebek Bezi Jumbo yorumlar");
      return new Response(JSON.stringify({ web: { results: short ? [{ title: "t", url: "https://www.trendyol.com/p", description: "Çok memnun kaldım, uygun fiyat" }] : [] } }));
    }) as unknown as typeof fetch;
    const r = await searchReviews({ productName: "Molfix Bebek Bezi Jumbo Mini 36'lı", brand: "Molfix", category: "baby" }, "1", f, { BRAVE_SEARCH_API_KEY: "b" });
    expect(urls[0]).not.toContain("Molfix Molfix");
    expect(r.mode).toBe("live");
  });
});

describe("yorum olmayan sayfa metinleri elenir", () => {
  it("reklam/boş cümleler yorum sayılmaz; gerçek yorum kalır", async () => {
    const { isReviewLike } = await import("./reviewSearch");
    expect(isReviewLike("Bebek Bezi Beden:2 Mini 160 Adet yorumlarını inceleyin, Trendyol'a özel indirimli fiyata satın alın.")).toBe(false);
    expect(isReviewLike("Bu sayfada bilgi yok.")).toBe(false);
    expect(isReviewLike("Kısa metin")).toBe(false);
    expect(isReviewLike("Bebeğimde kızarıklık yapmadı, 3 aydır kullanıyoruz, çok memnunuz.")).toBe(true);
  });
  it("yalnızca reklam metni dönerse yorum listesi boş, demo moda düşer", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ web: { results: [
      { title: "t", url: "https://www.trendyol.com/p", description: "Ürünü inceleyin, Trendyol'a özel indirimli fiyata satın alın." },
      { title: "t2", url: "https://www.trendyol.com/q", description: "Bu sayfada bilgi yok." },
    ] } }))) as unknown as typeof fetch;
    const r = await searchReviews({ productName: "Bebek Bezi", brand: "Molfix", category: "baby" }, "1", f, { BRAVE_SEARCH_API_KEY: "b" });
    expect(r.mode).toBe("demo");
  });
});

describe("Molfix ekranı: yorum olmayan kayıtlar ve gramaj", () => {
  const brave = (results: { title: string; url: string; description: string }[]) =>
    vi.fn(async () => new Response(JSON.stringify({ web: { results } }))) as unknown as typeof fetch;
  const input = { productName: "Molfix 3D Eko Paket Mini 36Lı", brand: "Molfix", category: "baby" as const };

  it("Instagram, marka sitesi, menü metni ve duygusuz özetler elenir; gerçek yorum kalır", async () => {
    const f = brave([
      { title: "i", url: "https://www.instagram.com/p/x", description: "Molfix Tatlı Rüyalar bebek bezi ile sana ve bebeğine kalan tek şey iyi bir gece uykusu #Molfix" },
      { title: "m", url: "https://www.molfix.com.tr/urunler", description: "Prematüre Bantlı Bebek Bezi · Molfix Premium Yenidoğan · Molfix Tatlı Rüyalar · Mini Bebek Bezi" },
      { title: "n", url: "https://www.trendyol.com/m", description: "Bez 36 adet 2 numara paket içeriği ve ölçüleri aşağıdaki gibidir sipariş detayları" },
      { title: "h", url: "https://www.hepsiburada.com/m", description: "Bebeğimin cildinde pişik yapmadı, çok memnun kaldım, kargo da hızlıydı" },
    ]);
    const r = await searchReviews(input, "1", f, { BRAVE_SEARCH_API_KEY: "b" });
    expect(r.mode).toBe("live");
    expect(r.reviews).toHaveLength(1);
    expect(r.reviews[0].source).toBe("hepsiburada");
    expect(r.reviews[0].rating).toBeGreaterThanOrEqual(4);
  });

  it("hepsi elenirse demo moda (Veri yok) düşer", async () => {
    const f = brave([{ title: "i", url: "https://www.instagram.com/p/x", description: "Molfix Tatlı Rüyalar bebek bezi ile iyi bir gece uykusu #Molfix" }]);
    expect((await searchReviews(input, "1", f, { BRAVE_SEARCH_API_KEY: "b" })).mode).toBe("demo");
  });

  it("'36Lı' adet ifadesi litre sayılmaz", async () => {
    const f = brave([
      { title: "Molfix 3D Eko Paket Mini 36Lı Bebek Bezi 8690536821129", url: "https://www.trendyol.com/m", description: "8690536821129" },
      { title: "Molfix 3D Eko Paket Mini 36Lı Bebek Bezi", url: "https://www.hepsiburada.com/m", description: "8690536821129" },
    ]);
    const r = await webLookupProduct("8690536821129", "baby", f, { BRAVE_SEARCH_API_KEY: "b" });
    expect(r?.quantity).toBeUndefined();
  });
});

describe("kara liste, teslimat filtresi, forum önceliği", () => {
  const brave = (results: { title: string; url: string; description: string }[]) =>
    vi.fn(async () => new Response(JSON.stringify({ web: { results } }))) as unknown as typeof fetch;
  const input = { productName: "Molfix Bebek Bezi", brand: "Molfix", category: "baby" as const };

  it("sorgulara -site: dışlamaları eklenir; bebekte forum sorgusu da atılır", async () => {
    const urls: string[] = [];
    const f = vi.fn(async (u: string) => { urls.push(decodeURIComponent(u)); return new Response(JSON.stringify({ web: { results: [] } })); }) as unknown as typeof fetch;
    await searchReviews(input, "1", f, { BRAVE_SEARCH_API_KEY: "b" });
    const first = urls.slice(0, 5);
    expect(first).toHaveLength(5); // google, trendyol, hepsiburada, amazon, forum
    for (const u of first) {
      expect(u).toContain("-site:instagram.com");
      expect(u).toContain("-site:tiktok.com");
      expect(u).toContain("-site:molfix.com.tr");
    }
    expect(first.some((u) => u.includes("site:kadinlarkulubu.com OR site:eksisozluk.com"))).toBe(true);
    // bebek dışı kategoride forum sorgusu yok
    urls.length = 0;
    await searchReviews({ ...input, category: "food" }, "1", f, { BRAVE_SEARCH_API_KEY: "b" });
    expect(urls.slice(0, 4).some((u) => u.includes("kadinlarkulubu"))).toBe(false);
  });

  it("yalnızca kargo/satıcı yorumu elenir; karışık yorumda ürün kısmı kalır", async () => {
    const { stripDelivery, inferRating } = await import("@/lib/scoring/reviewAnalyzer");
    expect(stripDelivery("Hızlı kargo, satıcı iyi paketlemiş, kurye çok nazikti")).toBe("");
    expect(stripDelivery("Kargoya verdiler, bebeğimde kızarıklık yaptı, hiç memnun kalmadım")).toContain("kızarıklık");
    expect(inferRating("Çok hızlı kargo, satıcı iyi paketlemiş", "baby")).toBe(3); // duygu yok
    expect(inferRating("Kargo süperdi ama bebeğimde kızarıklık yaptı", "baby")).toBeLessThan(3);
    const f = brave([{ title: "t", url: "https://www.trendyol.com/p", description: "Hızlı kargo, satıcı iyi paketlemiş, kurye çok nazikti, teşekkürler" }]);
    expect((await searchReviews(input, "1", f, { BRAVE_SEARCH_API_KEY: "b" })).mode).toBe("demo");
  });

  it("aynı sonuç birden çok sorguda gelse bile tek yorum; bebekte forum > Trendyol sıralı", async () => {
    const f = brave([
      { title: "t", url: "https://www.trendyol.com/p", description: "Bebeğimde pişik yapmadı, çok memnun kaldım, güzel koku" },
      { title: "k", url: "https://www.kadinlarkulubu.com/konu", description: "Bu bezi öneririm, bebeğimin cildinde tahriş yapmadı, memnunuz" },
    ]);
    const r = await searchReviews(input, "1", f, { BRAVE_SEARCH_API_KEY: "b" });
    expect(r.reviews).toHaveLength(2); // 5 sorgu aynı sonucu döndürse de tekrarsız
    expect(r.reviews[0].source).toBe("forum");
    expect(r.reviews[1].source).toBe("trendyol");
  });
});

describe("tanıtım metinleri yorum havuzuna girmez; fiyat tekil üründen gelir", () => {
  const brave = (results: { title: string; url: string; description: string }[]) =>
    vi.fn(async () => new Response(JSON.stringify({ web: { results } }))) as unknown as typeof fetch;
  it("Hepsiburada katalog metni elenir, gerçek yorum kalır; fiyat koliden değil tekil üründen", async () => {
    const f = brave([
      { title: "Molfix Bebek Bezi Mini 36'lı", url: "https://www.hepsiburada.com/a", description: "Yerli üretim kalitesiyle öne çıkan bebek bezi. Bezin 5 yönden esnek yapısı sayesinde rahat hareket." },
      { title: "Molfix Bebek Bezi Mini 36'lı Koli", url: "https://www.hepsiburada.com/b", description: "4'lü koli fiyatı 1.499,90 TL" },
      { title: "Molfix Bebek Bezi Mini 36'lı", url: "https://www.trendyol.com/c", description: "Bebeğime aldık, pişik yapmadı, çok memnun kaldık. Fiyat : ₺151,50" },
    ]);
    const r = await searchReviews({ productName: "Molfix Bebek Bezi Mini 36'lı", brand: "Molfix", category: "baby" }, "1", f, { BRAVE_SEARCH_API_KEY: "b" });
    expect(r.mode).toBe("live");
    expect(r.reviews).toHaveLength(1);
    expect(r.reviews[0].text).toContain("Bebeğime aldık");
    expect(r.prices).toEqual([151.5]);
  });
});

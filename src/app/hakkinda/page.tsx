import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Yöntem ve Sorumluluk Reddi · NetSkor" };

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-2">
    <h2 className="text-base font-bold">{title}</h2>
    <div className="flex flex-col gap-2 text-sm leading-relaxed text-slate-300">{children}</div>
  </section>
);

export default function AboutPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-7 px-4 py-8">
      <Link href="/" className="text-sm text-slate-400">← Ana Sayfa</Link>
      <h1 className="text-2xl font-bold">Yöntem ve Sorumluluk Reddi</h1>

      <Section title="NetSkor nedir?">
        <p>NetSkor, ürün içeriği, kullanıcı geri bildirimi ve fiyat bilgisini bir araya getirerek 0-100 arası bilgilendirici bir skor üretir. Skor bir tavsiye veya hüküm değil, karar vermeye yardımcı bir özettir.</p>
      </Section>

      <Section title="Veri kaynakları">
        <p><b>İçerik:</b> Open Food Facts ve Open Beauty Facts (topluluk katkılı açık veri tabanları). Bulunamazsa internet arama sonuçlarından otomatik çıkarım yapılır; bu durumda veri “Doğrulanmamış” olarak işaretlenir.</p>
        <p><b>Yorumlar ve fiyat:</b> Arama motoru sonuçlarındaki kısa özetlerden (snippet) çıkarılır. Bunlar gerçek kullanıcı yorumlarının tamamı değildir; “Arama özeti” olarak etiketlenir. API anahtarı yoksa örnek veri gösterilir ve “Örnek veri” olarak etiketlenir.</p>
      </Section>

      <Section title="Güven etiketleri">
        <p><b>Kaynaklı veri:</b> açık veri tabanından geldi. <b>Doğrulanmamış:</b> otomatik veya kullanıcı katkısı. <b>Arama özeti:</b> arama sonucu özetlerinden tahmin. <b>Örnek veri:</b> gerçek değil, gösterim amaçlı. <b>Veri yok:</b> bulunamadı; skor hesabında nötr değer kullanılır ve içerik verisi yoksa skor hiç gösterilmez.</p>
      </Section>

      <Section title="Skor nasıl hesaplanır?">
        <p>Bebek ürünlerinde içerik %40, ebeveyn yorumları ve şikayet oranı %35, onay ve doğallık %15, fiyat %10. Kozmetikte içerik %35, memnuniyet %40, fiyat %25. Gıdada beğeni %45, içerik temizliği %30, fiyat %25. Temizlik ürünlerinde içerik %40, memnuniyet %35, fiyat %25 kullanılır. İçerik puanı; paraben, SLS/SLES, parfüm, fenoksietanol, palm yağı, E kodlu katkılar gibi bilinen risk işaretlerinin varlığına göre kural tabanlı düşürülür. Bir içeriğin bulunması zarar verdiği anlamına gelmez; bireysel hassasiyetler değişir.</p>
      </Section>

      <Section title="Sorumluluk reddi">
        <p>NetSkor bilgilendirme amaçlıdır; tıbbi, hukuki veya profesyonel tavsiye değildir. Özellikle bebek, çocuk ve alerjisi olan kişiler için karar vermeden önce ürün ambalajındaki içerik listesini okuyun ve bir sağlık uzmanına danışın. Veriler eksik, güncel olmayan veya hatalı olabilir; doğruluğu garanti edilmez. Markalar veya ürünler hakkında hüküm verilmez; skor yalnızca yukarıdaki yöntemle üretilmiş otomatik bir özettir.</p>
      </Section>

      <Section title="Hata bildirimi">
        <p>Yanlış veya eksik bir ürün bilgisi görürseniz, ürünü bulunamadı ekranındaki katkı formu ile ekleyebilirsiniz.</p>
      </Section>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "NetSkor",
  description: "Tüketici ürünleri güven & yorum analiz platformu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="dark">
      <body className="min-h-screen antialiased">{children}
        <footer className="mx-auto max-w-2xl px-4 pb-8 pt-2 text-center text-[11px] text-slate-600">
          Bilgilendirme amaçlıdır; tıbbi tavsiye değildir. <Link href="/hakkinda" className="underline">Yöntem ve sorumluluk reddi</Link>
        </footer>
      </body>
    </html>
  );
}

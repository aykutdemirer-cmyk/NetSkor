import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NetSkor",
  description: "Tüketici ürünleri güven & yorum analiz platformu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

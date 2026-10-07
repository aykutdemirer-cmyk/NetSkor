"use client";

import { useRouter } from "next/navigation";
import ScannerHub from "@/components/ScannerHub";

export default function HomePage() {
  const router = useRouter();
  // Katman 3'te /product/[barcode] sayfası eklenecek
  return (
    <ScannerHub
      onProductSelect={(barcode, category) => router.push(`/product/${encodeURIComponent(barcode)}?c=${category}`)}
    />
  );
}

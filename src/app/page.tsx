"use client";

import { useRouter } from "next/navigation";
import { resolveSearchTarget } from "@/lib/routing";
import ScannerHub from "@/components/ScannerHub";

export default function HomePage() {
  const router = useRouter();
  return (
    <ScannerHub
      // değer barkodsa ürün sayfasına, metinse /search sonuçlarına gider
      onProductSelect={(value, category) => router.push(resolveSearchTarget(value, category))}
    />
  );
}

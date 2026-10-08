import { cacheGet, cacheSet } from "@/lib/cache";

/**
 * Basit sayaç tabanlı sınırlayıcı (Redis varsa kalıcı, yoksa süreç belleği). Atomik değildir; maliyet koruması için yeterli.
 * true = izin verildi.
 */
export async function allow(key: string, limit: number, windowSec: number): Promise<boolean> {
  const count = (await cacheGet<number>(key)) ?? 0;
  if (count >= limit) return false;
  await cacheSet(key, count + 1, windowSec);
  return true;
}

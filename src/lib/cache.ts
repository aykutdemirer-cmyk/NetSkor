// Önbellek/veri deposu: Upstash Redis (REST) bağlıysa kalıcı, değilse süreç belleği (sunucusuz ortamda geçici).
// Vercel Marketplace > Upstash Redis eklenince KV_REST_API_URL / KV_REST_API_TOKEN otomatik tanımlanır.
type Env = Record<string, string | undefined>;
type Fetcher = typeof fetch;

const mem = new Map<string, { v: string; exp: number }>();

function cfg(env: Env) {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

/** Kalıcı depolama bağlı mı? (katkı formu bunu gerektirir) */
export const isPersistent = (env: Env = process.env) => !!cfg(env);

async function redis(cmd: (string | number)[], env: Env, f: Fetcher): Promise<unknown> {
  const c = cfg(env)!;
  const res = await f(c.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    signal: AbortSignal.timeout(2500),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  return (await res.json()).result;
}

export async function cacheGet<T>(key: string, env: Env = process.env, f: Fetcher = fetch): Promise<T | null> {
  try {
    if (cfg(env)) {
      const raw = (await redis(["GET", key], env, f)) as string | null;
      return raw ? (JSON.parse(raw) as T) : null;
    }
    const hit = mem.get(key);
    if (!hit || (hit.exp && hit.exp < Date.now())) return null;
    return JSON.parse(hit.v) as T;
  } catch (e) {
    console.error("[cache] okuma hatası:", e instanceof Error ? e.message : e);
    return null; // önbellek hatası uygulamayı bozmaz
  }
}

/** ttlSec verilmezse süresiz saklanır. */
export async function cacheSet(key: string, value: unknown, ttlSec?: number, env: Env = process.env, f: Fetcher = fetch): Promise<boolean> {
  const raw = JSON.stringify(value);
  try {
    if (cfg(env)) {
      await redis(ttlSec ? ["SET", key, raw, "EX", ttlSec] : ["SET", key, raw], env, f);
    } else {
      mem.set(key, { v: raw, exp: ttlSec ? Date.now() + ttlSec * 1000 : 0 });
    }
    return true;
  } catch (e) {
    console.error("[cache] yazma hatası:", e instanceof Error ? e.message : e);
    return false;
  }
}

export const _clearMemoryCache = () => mem.clear(); // testler için

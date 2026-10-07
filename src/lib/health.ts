type Fetcher = typeof fetch;
type Env = Record<string, string | undefined>;

export interface HealthReport {
  status: "ok" | "degraded";
  time: string;
  checks: {
    openfoodfacts: boolean;
    openbeautyfacts: boolean;
    search: "serpapi" | "google" | "demo"; // yapılandırma; kota harcamamak için canlı çağrı yok
  };
}

async function ping(host: string, f: Fetcher): Promise<boolean> {
  try {
    // En hafif uç: tek alan, bilinen barkod
    const res = await f(`${host}/api/v2/product/3017620422003.json?fields=code`, {
      headers: { "User-Agent": "NetSkor/0.1 (healthcheck)" },
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function checkHealth(f: Fetcher = fetch, env: Env = process.env): Promise<HealthReport> {
  const [off, obf] = await Promise.all([ping("https://world.openfoodfacts.org", f), ping("https://world.openbeautyfacts.org", f)]);
  const search = env.SERPAPI_KEY ? "serpapi" : env.GOOGLE_SEARCH_API_KEY && env.GOOGLE_SEARCH_CX ? "google" : "demo";
  // En az bir ürün kaynağı ayakta ise uygulama kullanılabilir; aksi halde mock'a düşer
  return { status: off || obf ? "ok" : "degraded", time: new Date().toISOString(), checks: { openfoodfacts: off, openbeautyfacts: obf, search } };
}

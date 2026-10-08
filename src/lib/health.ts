import { configuredProviders, type ProviderId } from "@/lib/api/searchProviders";

type Fetcher = typeof fetch;
type Env = Record<string, string | undefined>;

export interface HealthReport {
  status: "ok" | "degraded";
  time: string;
  checks: {
    openfoodfacts: boolean;
    openbeautyfacts: boolean;
    search: ProviderId | "demo"; // zincirdeki ilk (birincil) sağlayıcı
    searchProviders: ProviderId[]; // tanımlı yedek zinciri, denenme sırasıyla
    serpapiKey?: "valid" | "invalid" | "unreachable"; // yalnızca ?deep=1 (kota harcamayan account API)
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

async function checkSerpKey(key: string, f: Fetcher): Promise<"valid" | "invalid" | "unreachable"> {
  try {
    const res = await f(`https://serpapi.com/account.json?api_key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    return res.ok ? "valid" : res.status === 401 || res.status === 403 ? "invalid" : "unreachable";
  } catch {
    return "unreachable";
  }
}

export async function checkHealth(f: Fetcher = fetch, env: Env = process.env, deep = false): Promise<HealthReport> {
  const [off, obf] = await Promise.all([ping("https://world.openfoodfacts.org", f), ping("https://world.openbeautyfacts.org", f)]);
  const providers = configuredProviders(env);
  const search = providers[0] ?? "demo";
  // En az bir ürün kaynağı ayakta ise uygulama kullanılabilir; aksi halde mock'a düşer
  const checks: HealthReport["checks"] = { openfoodfacts: off, openbeautyfacts: obf, search, searchProviders: providers };
  if (deep && env.SERPAPI_KEY) checks.serpapiKey = await checkSerpKey(env.SERPAPI_KEY, f);
  return { status: off || obf ? "ok" : "degraded", time: new Date().toISOString(), checks };
}

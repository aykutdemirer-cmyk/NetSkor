// Web arama sağlayıcıları ve yedek zinciri: SerpAPI -> Serper.dev -> Brave -> Google CSE.
// Anahtarı tanımlı olanlar sırayla denenir; kota/yetki/ağ hatasında bir sonrakine geçilir.
export interface WebHit { title: string; snippet: string; link: string; rating?: number }
export type ProviderId = "serpapi" | "serper" | "brave" | "google";

type Env = Record<string, string | undefined>;
type Fetcher = typeof fetch;

export class ProviderError extends Error {
  constructor(public provider: ProviderId, public status: number) {
    super(`${provider} ${status}`);
  }
}

export function configuredProviders(env: Env = process.env): ProviderId[] {
  const list: ProviderId[] = [];
  if (env.SERPAPI_KEY) list.push("serpapi");
  if (env.SERPER_API_KEY) list.push("serper");
  if (env.BRAVE_SEARCH_API_KEY) list.push("brave");
  if (env.GOOGLE_SEARCH_API_KEY && env.GOOGLE_SEARCH_CX) list.push("google");
  return list;
}

const T = 8000;

async function json(p: ProviderId, res: Response) {
  if (!res.ok) throw new ProviderError(p, res.status);
  return res.json();
}

const RUNNERS: Record<ProviderId, (q: string, env: Env, f: Fetcher) => Promise<WebHit[]>> = {
  async serpapi(q, env, f) {
    const url = `https://serpapi.com/search.json?engine=google&hl=tr&gl=tr&num=5&q=${encodeURIComponent(q)}&api_key=${env.SERPAPI_KEY}`;
    const j = await json("serpapi", await f(url, { signal: AbortSignal.timeout(T) }));
    return (j.organic_results ?? []).map((r: any) => ({ title: r.title ?? "", snippet: r.snippet ?? "", link: r.link ?? "", rating: r.rich_snippet?.top?.detected_extensions?.rating }));
  },
  async serper(q, env, f) {
    const res = await f("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": env.SERPER_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ q, gl: "tr", hl: "tr", num: 5 }),
      signal: AbortSignal.timeout(T),
    });
    const j = await json("serper", res);
    return (j.organic ?? []).map((r: any) => ({ title: r.title ?? "", snippet: r.snippet ?? "", link: r.link ?? "", rating: r.rating }));
  },
  async brave(q, env, f) {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&country=tr&search_lang=tr&count=5`;
    const res = await f(url, { headers: { "X-Subscription-Token": env.BRAVE_SEARCH_API_KEY!, Accept: "application/json" }, signal: AbortSignal.timeout(T) });
    const j = await json("brave", res);
    return (j.web?.results ?? []).map((r: any) => ({ title: r.title ?? "", snippet: String(r.description ?? "").replace(/<[^>]+>/g, ""), link: r.url ?? "" }));
  },
  async google(q, env, f) {
    const url = `https://www.googleapis.com/customsearch/v1?key=${env.GOOGLE_SEARCH_API_KEY}&cx=${env.GOOGLE_SEARCH_CX}&hl=tr&num=5&q=${encodeURIComponent(q)}`;
    const j = await json("google", await f(url, { signal: AbortSignal.timeout(T) }));
    return (j.items ?? []).map((r: any) => ({ title: r.title ?? "", snippet: r.snippet ?? "", link: r.link ?? "", rating: Number(r.pagemap?.aggregaterating?.[0]?.ratingvalue) || undefined }));
  },
};

// Kota/yetki hatası veren sağlayıcı bir süre devre dışı: her istekte boşuna denenmez
const downUntil = new Map<ProviderId, number>();
export const _resetProviders = () => downUntil.clear();

const COOLDOWN_MS: Record<number, number> = { 429: 10 * 60_000, 402: 60 * 60_000, 401: 60 * 60_000, 403: 60 * 60_000 };

/** İlk başarılı sağlayıcının sonuçlarını döner; hepsi başarısızsa (ya da hiçbiri tanımlı değilse) null. */
export async function searchWeb(q: string, env: Env = process.env, f: Fetcher = fetch): Promise<{ hits: WebHit[]; provider: ProviderId } | null> {
  for (const id of configuredProviders(env)) {
    if ((downUntil.get(id) ?? 0) > Date.now()) continue;
    try {
      return { hits: await RUNNERS[id](q, env, f), provider: id };
    } catch (e) {
      const status = e instanceof ProviderError ? e.status : 0;
      if (COOLDOWN_MS[status]) downUntil.set(id, Date.now() + COOLDOWN_MS[status]);
      console.error(`[search] ${id} başarısız (${e instanceof Error ? e.message : e}); sıradaki sağlayıcı deneniyor`);
    }
  }
  return null;
}

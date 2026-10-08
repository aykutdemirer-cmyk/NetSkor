# NetSkor – Vercel Dağıtımı

## 1. Token ve proje kimlikleri (bir kez)
1. https://vercel.com/account/tokens → **Create Token** (`VERCEL_TOKEN`).
2. Terminalde: `npx vercel login && npx vercel link` → `.vercel/project.json` oluşur;
   içindeki `orgId` = `VERCEL_ORG_ID`, `projectId` = `VERCEL_PROJECT_ID`.

## 2. Ortam değişkenleri
Vercel → Project → Settings → Environment Variables (Production + Preview):

| Değişken | Zorunlu | Not |
|---|---|---|
| `SERPAPI_KEY` | hayır* | serpapi.com (ücretsiz ~250 arama/ay) |
| `SERPER_API_KEY` | hayır* | serper.dev (yedek) |
| `BRAVE_SEARCH_API_KEY` | hayır* | brave.com/search/api (yedek) |
| `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_CX` | hayır* | Google Custom Search (yedek) |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | hayır | kalıcı önbellek ve katkı formu |

| `ANTHROPIC_API_KEY` | hayır | görselden ürün tanıma (ücretli); yoksa yalnızca görseldeki barkod okunur |

\* Sağlayıcılar **sırayla** denenir (SerpAPI → Serper → Brave → Google). Biri kota/hata verirse
sıradakine geçilir; 429/401/403 alan sağlayıcı 10-60 dk devre dışı kalır. Hiçbiri yoksa **demo verisi** gösterilir.
CLI ile: `npx vercel env add SERPAPI_KEY production`

## 3. Tek komutla yayın
```bash
npm run deploy        # check + Preview deploy
npm run deploy:prod   # check + Production deploy
```
`check` = `tsc --noEmit && next lint && vitest run`; hata varsa deploy başlamaz.

## 4. Otomatik yayın (GitHub Actions)
`.github/workflows/deploy.yml` için repo Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID`, (opsiyonel) `SERPAPI_KEY`.
`main`'e push → Production; diğer dallar/PR → Preview.

## 5. Doğrulama
`curl https://<alan-adı>/api/health` → `status: "ok"`; `checks.searchProviders` tanımlı yedek zincirini gösterir
(`search: "demo"` ise hiçbir arama anahtarı tanımlı değildir). Kamera için sayfa HTTPS üzerinden açılmalıdır.

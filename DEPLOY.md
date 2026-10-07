# NetSkor – Vercel Dağıtımı

## 1. Token ve proje kimlikleri (bir kez)
1. https://vercel.com/account/tokens → **Create Token** (`VERCEL_TOKEN`).
2. Terminalde: `npx vercel login && npx vercel link` → `.vercel/project.json` oluşur;
   içindeki `orgId` = `VERCEL_ORG_ID`, `projectId` = `VERCEL_PROJECT_ID`.

## 2. Ortam değişkenleri
Vercel → Project → Settings → Environment Variables (Production + Preview):

| Değişken | Zorunlu | Not |
|---|---|---|
| `SERPAPI_KEY` | hayır* | serpapi.com API anahtarı |
| `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_CX` | hayır* | SerpAPI yerine Google Custom Search |

\* Hiçbiri yoksa yorum/fiyat **demo verisi** gösterilir (sayfada uyarı çıkar).
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
`curl https://<alan-adı>/api/health` → `status: "ok"` ve `checks.search` = `serpapi` / `google`
(`demo` ise arama anahtarı tanımlı değildir). Kamera için sayfa HTTPS üzerinden açılmalıdır.

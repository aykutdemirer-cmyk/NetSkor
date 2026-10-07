// Tarayıcı özellikleri: kamera yalnızca kendi origin'imizde; mikrofon/konum kapalı
const securityHeaders = [
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // next/image kullanılırsa izinli harici kaynaklar (şu an <img> ile gösteriliyor)
    remotePatterns: [
      { protocol: "https", hostname: "images.openfoodfacts.org" },
      { protocol: "https", hostname: "images.openbeautyfacts.org" },
      { protocol: "https", hostname: "static.openfoodfacts.org" },
      { protocol: "https", hostname: "cdn.dsmcdn.com" }, // Trendyol
      { protocol: "https", hostname: "productimages.hepsiburada.net" }, // Hepsiburada
      { protocol: "https", hostname: "m.media-amazon.com" }, // Amazon
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

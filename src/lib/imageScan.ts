// Tarayıcıda çalışır: yüklenen ambalaj fotoğrafından önce barkodu çözer, olmazsa sunucuya (vision) gönderir.
import { isValidEan } from "@/lib/ean";
import type { Category } from "@/types";

export type ScanResult =
  | { kind: "barcode"; value: string }
  | { kind: "query"; value: string; category?: Category; confidence: "high" | "medium" | "low" }
  | { kind: "none"; reason: "unreadable" | "not_configured" | "rate_limited" | "error" | "bad_file" };

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

/** Büyük fotoğrafı yeniden boyutlandırır; EXIF yönünü uygular. */
export async function toCanvas(file: Blob, maxDim: number): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas;
}

/** Tarayıcının yerel BarcodeDetector'ı (Chrome/Android) varsa onu, yoksa ZXing'i kullanır. Sağlama toplamı geçerli değilse reddeder. */
export async function decodeBarcode(canvas: HTMLCanvasElement): Promise<string | null> {
  const Detector = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => { detect(i: CanvasImageSource): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
  if (Detector) {
    try {
      const found = await new Detector({ formats: FORMATS }).detect(canvas);
      const hit = found.map((f) => f.rawValue).find(isValidEan);
      if (hit) return hit;
    } catch { /* ZXing'e düş */ }
  }
  try {
    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    const { BarcodeFormat, DecodeHintType } = await import("@zxing/library");
    const hints = new Map<unknown, unknown>([
      [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
      [DecodeHintType.TRY_HARDER, true],
    ]);
    const text = new BrowserMultiFormatReader(hints as never).decodeFromCanvas(canvas).getText();
    return isValidEan(text) ? text : null;
  } catch {
    return null; // barkod bulunamadı
  }
}

/** Fotoğraftan sonuç: 1) barkod (ücretsiz, cihazda) 2) ürün tanıma (sunucu, vision). */
export async function analyzeImage(file: File, onStatus: (s: string) => void): Promise<ScanResult> {
  if (!file.type.startsWith("image/")) return { kind: "none", reason: "bad_file" };
  try {
    onStatus("Barkod aranıyor…");
    // Küçük barkodlar için birkaç ölçek denenir
    for (const dim of [1600, 1000, 2400]) {
      const code = await decodeBarcode(await toCanvas(file, dim));
      if (code) return { kind: "barcode", value: code };
    }

    onStatus("Barkod okunamadı, ürün ambalajdan tanınıyor…");
    const canvas = await toCanvas(file, 1280);
    const res = await fetch("/api/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: canvas.toDataURL("image/jpeg", 0.82), mediaType: "image/jpeg" }),
    });
    if (res.status === 501) return { kind: "none", reason: "not_configured" };
    if (res.status === 429) return { kind: "none", reason: "rate_limited" };
    if (!res.ok) return { kind: "none", reason: "error" };

    const { result } = (await res.json()) as { result: { barcode?: string; query?: string; category?: Category; confidence: "high" | "medium" | "low" } | null };
    if (result?.barcode) return { kind: "barcode", value: result.barcode };
    if (result?.query) return { kind: "query", value: result.query, category: result.category, confidence: result.confidence };
    return { kind: "none", reason: "unreadable" };
  } catch {
    return { kind: "none", reason: "error" };
  }
}

export const NONE_MESSAGE: Record<Extract<ScanResult, { kind: "none" }>["reason"], string> = {
  unreadable: "Görselden ürün tanınamadı. Barkodu net ve yakından çekmeyi ya da ürün adını yazmayı dene.",
  not_configured: "Barkod görselde okunamadı. Ambalajdan ürün tanıma bu sitede kapalı; barkodu yakından çek ya da ürün adını yaz.",
  rate_limited: "Görselden tanıma şu an yoğun. Biraz sonra dene ya da ürün adını yaz.",
  error: "Görsel işlenemedi. Başka bir fotoğraf dene ya da ürün adını yaz.",
  bad_file: "Lütfen bir görsel dosyası seç.",
};

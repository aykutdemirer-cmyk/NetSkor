"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CameraOff, X } from "lucide-react";
import type { DecodeHintType as HintType } from "@zxing/library";

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}

type Status = "starting" | "scanning" | "done" | "denied" | "no-camera" | "error";

const ERRORS: Partial<Record<Status, { title: string; body: string }>> = {
  denied: { title: "Kamera izni verilmedi", body: "Tarayıcı ayarlarından kamera iznini açabilir ya da barkodu elle girebilirsin." },
  "no-camera": { title: "Kamera bulunamadı", body: "Bu cihazda kullanılabilir bir kamera yok. Barkodu elle girebilirsin." },
  error: { title: "Kamera başlatılamadı", body: "Başka bir uygulama kamerayı kullanıyor olabilir. Tekrar dene ya da elle gir." },
};

export default function BarcodeScannerModal({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [attempt, setAttempt] = useState(0); // "Tekrar dene" için yeniden başlatma tetikleyici

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let stop = () => {};
    setStatus("starting");

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setStatus("no-camera");
      try {
        // Dinamik import: zxing yalnızca modal açılınca yüklenir (SSR güvenli)
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const { BarcodeFormat, DecodeHintType } = await import("@zxing/library");
        const hints = new Map<HintType, unknown>([
          [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
          [DecodeHintType.TRY_HARDER, true],
        ]);
        const reader = new BrowserMultiFormatReader(hints as Map<HintType, any>, { delayBetweenScanAttempts: 120 });
        const video = videoRef.current!;
        let handled = false;

        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          video,
          (result) => {
            if (!result || handled || cancelled) return;
            handled = true;
            navigator.vibrate?.(200);
            setStatus("done");
            release();
            setTimeout(() => onDetected(result.getText()), 450); // onay animasyonu için kısa bekleme
          },
        );

        function release() {
          controls.stop();
          const stream = video.srcObject as MediaStream | null;
          stream?.getTracks().forEach((t) => t.stop());
          video.srcObject = null;
        }
        stop = release;
        if (cancelled) release();
        else setStatus((s) => (s === "done" ? s : "scanning"));
      } catch (e) {
        if (cancelled) return;
        const name = (e as DOMException)?.name;
        if (name === "NotAllowedError" || name === "SecurityError") setStatus("denied");
        else if (name === "NotFoundError" || name === "OverconstrainedError") setStatus("no-camera");
        else setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
    // onDetected bilinçli olarak dışarıda: üst bileşen yeniden render olunca kamera yeniden başlamasın
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attempt]);

  if (!open) return null;
  const err = ERRORS[status];

  return (
    <div role="dialog" aria-modal="true" aria-label="Barkod tarayıcı" className="fixed inset-0 z-50 flex items-center justify-center bg-[#070b14]/90 p-4 backdrop-blur">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-[0_0_40px_-8px_#8b5cf6]">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-semibold">Barkodu çerçeveye hizala</h2>
          <button onClick={onClose} aria-label="Kapat" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative aspect-[4/3] bg-black">
          <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${err ? "hidden" : ""}`} />

          {!err && (
            <div className="pointer-events-none absolute inset-8">
              {["left-0 top-0 border-l-4 border-t-4 rounded-tl-xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl"].map((c) => (
                <span key={c} className={`absolute h-7 w-7 shadow-[0_0_12px_#22d3ee] ${c} ${status === "done" ? "border-green-400" : "border-cyan-400"}`} />
              ))}
              {status === "scanning" && <div className="animate-scan absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-fuchsia-400 to-transparent shadow-[0_0_14px_#e879f9]" />}
            </div>
          )}

          {status === "starting" && <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Kamera açılıyor…</p>}
          {status === "done" && (
            <div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
              <CheckCircle2 className="h-16 w-16 text-green-400" />
            </div>
          )}
          {err && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
              <CameraOff className="h-10 w-10 text-amber-400" />
              <p className="font-semibold">{err.title}</p>
              <p className="text-sm text-slate-400">{err.body}</p>
              <div className="flex gap-2">
                {status !== "no-camera" && (
                  <button onClick={() => setAttempt((n) => n + 1)} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold">Tekrar Dene</button>
                )}
                <button onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-sm">Elle Gir</button>
              </div>
            </div>
          )}
        </div>
        <p className="px-4 py-3 text-center text-xs text-slate-500">EAN-13 · EAN-8 · UPC desteklenir</p>
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ImagePlus, Search, ScanLine } from "lucide-react";
import type { Category } from "@/types";
import RecentProducts from "@/components/RecentProducts";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import { BABY_DEMOS, CATEGORIES, DEFAULT_CATEGORY } from "@/data/categories";

interface Props {
  onProductSelect: (barcode: string, category: Category) => void;
}

const Corner = ({ pos }: { pos: string }) => (
  <span className={`absolute h-7 w-7 border-cyan-400 shadow-[0_0_12px_#22d3ee] ${pos}`} />
);

export default function ScannerHub({ onProductSelect }: Props) {
  const [category, setCategory] = useState<Category>(DEFAULT_CATEGORY);
  const [query, setQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const active = CATEGORIES.find((c) => c.id === category)!;

  const submit = (value: string) => {
    const v = value.trim();
    if (v) onProductSelect(v, category);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-[#070b14] px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Net<span className="text-violet-400">Skor</span>
        </h1>
        <p className="text-sm text-slate-400">Önce kategori seç, sonra ürünü tara.</p>
      </header>

      {/* 1. Kategori seçici */}
      <section aria-label="Kategori" className="grid grid-cols-2 gap-3">
        {CATEGORIES.map(({ id, label, hint, Icon }) => {
          const on = id === category;
          return (
            <button
              key={id}
              onClick={() => setCategory(id)}
              aria-pressed={on}
              className={`rounded-2xl border p-3 text-left transition ${
                on
                  ? "border-violet-500 bg-violet-500/10 shadow-[0_0_20px_-4px_#8b5cf6]"
                  : "border-slate-800 bg-slate-900/60 hover:border-slate-600"
              }`}
            >
              <Icon className={`mb-2 h-6 w-6 ${on ? "text-violet-300" : "text-slate-400"}`} />
              <div className="text-sm font-semibold">{label}</div>
              <div className="text-xs text-slate-500">{hint}</div>
            </button>
          );
        })}
      </section>

      {/* 2. Vizör */}
      <section className="relative mx-auto aspect-[4/3] w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
        <div className="absolute inset-6">
          <Corner pos="left-0 top-0 rounded-tl-xl border-l-4 border-t-4" />
          <Corner pos="right-0 top-0 rounded-tr-xl border-r-4 border-t-4" />
          <Corner pos="bottom-0 left-0 rounded-bl-xl border-b-4 border-l-4" />
          <Corner pos="bottom-0 right-0 rounded-br-xl border-b-4 border-r-4" />
          <div className="animate-scan absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-fuchsia-400 to-transparent shadow-[0_0_14px_#e879f9]" />
          <ScanLine className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-slate-700" />
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={category}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 bottom-2 px-8 text-center text-xs text-slate-400"
          >
            {active.scanHint}
          </motion.p>
        </AnimatePresence>
      </section>

      <RecentProducts />

      {/* 3. Girdi seçenekleri */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setScanning(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 py-3 text-sm font-semibold text-white"
        >
          <Camera className="h-4 w-4" /> Kamerayı Aç
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 py-3 text-sm font-semibold"
        >
          <ImagePlus className="h-4 w-4" /> Görsel Yükle
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
        className="flex gap-2"
      >
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 focus-within:border-cyan-400">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            inputMode="search"
            placeholder="Barkod no veya ürün adı"
            className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-600"
          />
        </div>
        <button className="rounded-xl bg-violet-600 px-5 text-sm font-semibold">Ara</button>
      </form>

      {/* 4. Bebek demo butonları */}
      {category === "baby" && (
        <section aria-label="Hızlı test" className="flex flex-wrap gap-2">
          <span className="w-full text-xs uppercase tracking-wider text-slate-500">Hızlı Test</span>
          {BABY_DEMOS.map((d) => (
            <button
              key={d.barcode}
              onClick={() => {
                setQuery(d.barcode);
                onProductSelect(d.barcode, "baby");
              }}
              className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm hover:border-cyan-400"
            >
              {d.emoji} {d.label}
            </button>
          ))}
        </section>
      )}
      <BarcodeScannerModal
        open={scanning}
        onClose={() => setScanning(false)}
        onDetected={(code) => {
          setScanning(false);
          setQuery(code);
          onProductSelect(code, category);
        }}
      />
    </main>
  );
}

"use client";

import { useEffect } from "react";
import { addToHistory, type HistoryItem } from "@/lib/history";

// Görünmez; ürün sayfası render edilince geçmişe yazar
export default function HistoryRecorder({ item }: { item: HistoryItem }) {
  useEffect(() => {
    addToHistory(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.barcode]);
  return null;
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addToHistory, clearHistory, getHistory, HISTORY_EVENT, MAX_HISTORY, type HistoryItem } from "./history";

const item = (n: number, over: Partial<HistoryItem> = {}): HistoryItem => ({
  barcode: String(1000000 + n), name: `Ürün ${n}`, brand: "M", category: "baby", score: 80, band: "amber", ...over,
});

function mockStorage() {
  const data = new Map<string, string>();
  const ls = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: vi.fn((k: string, v: string) => void data.set(k, v)),
    removeItem: (k: string) => void data.delete(k),
  };
  const dispatchEvent = vi.fn();
  vi.stubGlobal("window", { localStorage: ls, dispatchEvent });
  return { data, ls, dispatchEvent };
}

describe("history", () => {
  let m: ReturnType<typeof mockStorage>;
  beforeEach(() => { m = mockStorage(); });
  afterEach(() => vi.unstubAllGlobals());

  it("en yeni başta", () => {
    addToHistory(item(1)); addToHistory(item(2));
    expect(getHistory().map((h) => h.name)).toEqual(["Ürün 2", "Ürün 1"]);
  });

  it("aynı barkod tekrar gelince en üste taşınır, tekrar etmez, güncel skor kalır", () => {
    addToHistory(item(1)); addToHistory(item(2)); addToHistory(item(1, { score: 55, band: "red" }));
    const h = getHistory();
    expect(h.map((x) => x.barcode)).toEqual(["1000001", "1000002"]);
    expect(h[0]).toMatchObject({ score: 55, band: "red" });
  });

  it("en fazla 10 kayıt; en eskiler düşer", () => {
    for (let i = 1; i <= 13; i++) addToHistory(item(i));
    const h = getHistory();
    expect(h).toHaveLength(MAX_HISTORY);
    expect(h[0].name).toBe("Ürün 13");
    expect(h.at(-1)!.name).toBe("Ürün 4");
  });

  it("clearHistory siler ve olay yayar", () => {
    addToHistory(item(1)); clearHistory();
    expect(getHistory()).toEqual([]);
    expect(m.data.size).toBe(0);
    expect(m.dispatchEvent.mock.calls.at(-1)![0].type).toBe(HISTORY_EVENT);
  });

  it("bozuk JSON ve geçersiz kayıtlar güvenle yok sayılır", () => {
    m.data.set("netskor:history:v1", "{bozuk");
    expect(getHistory()).toEqual([]);
    m.data.set("netskor:history:v1", JSON.stringify([item(1), { barcode: 5 }, null]));
    expect(getHistory()).toHaveLength(1);
    m.data.set("netskor:history:v1", JSON.stringify({ not: "array" }));
    expect(getHistory()).toEqual([]);
  });

  it("boş barkod eklenmez", () => {
    addToHistory(item(1, { barcode: "" }));
    expect(getHistory()).toEqual([]);
  });

  it("localStorage hata fırlatırsa çökmez", () => {
    m.ls.setItem.mockImplementation(() => { throw new Error("quota"); });
    expect(() => addToHistory(item(1))).not.toThrow();
  });
});

describe("SSR (window yok)", () => {
  it("okuma boş, yazma sessiz", () => {
    expect(getHistory()).toEqual([]);
    expect(() => { addToHistory(item(1)); clearHistory(); }).not.toThrow();
  });
});

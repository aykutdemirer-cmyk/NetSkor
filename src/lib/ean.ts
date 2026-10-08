/** EAN-8 / UPC-A (12) / EAN-13 sağlama toplamı doğrulaması: yanlış okunan veya modelin uydurduğu rakamları eler. */
export function isValidEan(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13].includes(code.length)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  // Sağdan sola, kontrol hanesi hariç: 3, 1, 3, 1...
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

"use server";

import { redirect } from "next/navigation";
import { saveContribution, validateContribution } from "@/lib/contrib";

export async function submitContribution(formData: FormData) {
  const parsed = validateContribution(Object.fromEntries(formData));
  const barcode = String(formData.get("barcode") ?? "").replace(/\D/g, "");
  if (!parsed.ok) redirect(`/contribute?barcode=${barcode}&error=${encodeURIComponent(parsed.errors[0])}`);
  if (!(await saveContribution(parsed.value))) redirect(`/contribute?barcode=${barcode}&error=${encodeURIComponent("Kayıt şu an yapılamadı.")}`);
  redirect(`/product/${parsed.value.barcode}?c=${parsed.value.category}`);
}

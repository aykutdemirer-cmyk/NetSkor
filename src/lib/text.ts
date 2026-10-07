// Türkçe metni aramaya uygun hale getirir: "Pişik" -> "pisik"
export const normTr = (s: string) =>
  s.toLocaleLowerCase("tr").replace(/ı/g, "i").normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Campo de texto de un FormData, sin espacios en los bordes ("" si falta o no es texto). */
export function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

/** "" -> null; número válido -> number; cualquier otra cosa -> NaN (que quien llama rechaza). */
export function numeroOpcional(valor: string): number | null {
  if (valor.trim() === "") return null;
  const n = Number(valor.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

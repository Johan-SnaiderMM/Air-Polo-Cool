import type { Operacion } from "@/lib/offline/operaciones";

/** Extensión con la que se sube una imagen comprimida (el navegador entrega WebP o JPEG). */
export function extensionDe(blob: Blob): "jpg" | "webp" {
  return blob.type === "image/jpeg" ? "jpg" : "webp";
}

/**
 * Formulario que recibe la Server Action `procesarOperacion`: la operación como JSON en `op` y, si
 * trae imagen, el archivo en `archivo`. Es el único formato de envío: tanto el registro directo
 * (con red) como el vaciado de la cola offline pasan por aquí.
 */
export function armarFormularioOperacion(op: Operacion, archivo?: Blob | null): FormData {
  const datos = new FormData();
  datos.set("op", JSON.stringify(op));
  if (archivo) {
    datos.set("archivo", new File([archivo], `adjunto.${extensionDe(archivo)}`, { type: archivo.type }));
  }
  return datos;
}

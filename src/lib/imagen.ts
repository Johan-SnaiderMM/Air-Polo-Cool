// Utilidad SOLO de cliente: usa Canvas y APIs del navegador.

export type OpcionesCompresion = {
  /** Lado mayor máximo en píxeles. */
  maxLado?: number;
  /** Tamaño objetivo en bytes. */
  maxBytes?: number;
};

export type ImagenComprimida = {
  blob: Blob;
  /** Extensión sin punto: "webp" | "jpg". */
  extension: "webp" | "jpg";
  ancho: number;
  alto: number;
};

const MAX_LADO = 1280;
const MAX_BYTES = 300 * 1024;
const CALIDAD_INICIAL = 0.82;
const CALIDAD_MINIMA = 0.4;

function aBlob(
  canvas: HTMLCanvasElement,
  tipo: string,
  calidad: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad));
}

async function cargarBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // "from-image" respeta la orientación EXIF (fotos verticales del celular).
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // cae al método con <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Redimensiona (lado mayor <= 1280 px) y comprime a WebP (o JPEG si el
 * navegador no soporta codificar WebP) hasta quedar cerca de ~300 KB.
 */
export async function comprimirImagen(
  file: File,
  { maxLado = MAX_LADO, maxBytes = MAX_BYTES }: OpcionesCompresion = {}
): Promise<ImagenComprimida> {
  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo seleccionado no es una imagen.");
  }

  const fuente = await cargarBitmap(file);
  const anchoOrigen =
    fuente instanceof HTMLImageElement ? fuente.naturalWidth : fuente.width;
  const altoOrigen =
    fuente instanceof HTMLImageElement ? fuente.naturalHeight : fuente.height;

  let escala = Math.min(1, maxLado / Math.max(anchoOrigen, altoOrigen));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no soporta el procesamiento de imágenes.");

  let mejor: Blob | null = null;
  let extension: "webp" | "jpg" = "webp";
  let ancho = 0;
  let alto = 0;

  // Hasta 4 pasadas: si con la calidad mínima aún pesa de más, reduce dimensiones.
  for (let pasada = 0; pasada < 4; pasada++) {
    ancho = Math.max(1, Math.round(anchoOrigen * escala));
    alto = Math.max(1, Math.round(altoOrigen * escala));
    canvas.width = ancho;
    canvas.height = alto;
    ctx.fillStyle = "#ffffff"; // evita fondo negro si el origen tiene transparencia
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(fuente, 0, 0, ancho, alto);

    for (
      let calidad = CALIDAD_INICIAL;
      calidad >= CALIDAD_MINIMA - 1e-6;
      calidad -= 0.1
    ) {
      let blob = await aBlob(canvas, "image/webp", calidad);
      if (blob && blob.type === "image/webp") {
        extension = "webp";
      } else {
        // Safari antiguo: toBlob('image/webp') devuelve PNG -> usar JPEG.
        blob = await aBlob(canvas, "image/jpeg", calidad);
        extension = "jpg";
      }
      if (!blob) throw new Error("No se pudo comprimir la imagen.");
      mejor = blob;
      if (blob.size <= maxBytes) {
        if ("close" in fuente) fuente.close();
        return { blob, extension, ancho, alto };
      }
    }
    escala *= 0.85;
  }

  if ("close" in fuente) fuente.close();
  if (!mejor) throw new Error("No se pudo comprimir la imagen.");
  return { blob: mejor, extension, ancho, alto };
}

/**
 * Algoritmo de vaciado de la cola offline (sin React ni IndexedDB: recibe sus dependencias).
 *
 * Reglas:
 *  - Estricto FIFO: una operación posterior nunca se envía antes que una anterior
 *    (una foto no debe llegar antes que la orden a la que pertenece).
 *  - Error PERMANENTE (validación, permisos, dato inexistente): la operación se marca
 *    "fallida" con su motivo y se sigue con las demás; queda visible para revisión manual.
 *  - Error TRANSITORIO o de RED: se detiene TODO y se reintenta después, sin marcar nada.
 *  - Sesión expirada: se detiene y se conserva la cola intacta (no se pierde nada).
 *  - Idempotencia: el servidor trata un id repetido como "ya hecho", así que reenviar tras un
 *    corte a mitad de camino nunca duplica registros.
 */
import type { ItemCola } from "@/lib/offline/almacen";
import type { Operacion } from "@/lib/offline/operaciones";
import type { ResultadoOperacion } from "@/lib/servidor/operaciones";

export type DependenciasCola = {
  listar: () => Promise<ItemCola[]>;
  leerBlob: (id: string) => Promise<Blob | null>;
  /** Lanza si no hay red. */
  enviar: (op: Operacion, archivo: Blob | null) => Promise<ResultadoOperacion>;
  eliminar: (seq: number) => Promise<void>;
  actualizar: (
    seq: number,
    cambios: Partial<Pick<ItemCola, "estado" | "error" | "intentos">>
  ) => Promise<void>;
};

export type MotivoParada = "red" | "sesion" | "transitorio" | null;

export type ResultadoVaciado = {
  enviadas: number;
  fallidas: number;
  parada: MotivoParada;
};

export async function vaciarCola(d: DependenciasCola): Promise<ResultadoVaciado> {
  const pendientes = (await d.listar()).filter((i) => i.estado === "pendiente");
  const resultado: ResultadoVaciado = { enviadas: 0, fallidas: 0, parada: null };

  for (const item of pendientes) {
    const blob = item.blobId ? await d.leerBlob(item.blobId) : null;
    if (item.blobId && !blob) {
      await d.actualizar(item.seq, { estado: "fallida", error: "Se perdió la foto adjunta." });
      resultado.fallidas++;
      continue;
    }

    let r: ResultadoOperacion;
    try {
      r = await d.enviar(item.operacion, blob);
    } catch {
      resultado.parada = "red";
      return resultado;
    }

    if (r.ok) {
      await d.eliminar(item.seq);
      resultado.enviadas++;
      continue;
    }
    if (r.sesion) {
      resultado.parada = "sesion";
      return resultado;
    }
    if (r.permanente) {
      await d.actualizar(item.seq, { estado: "fallida", error: r.error, intentos: item.intentos + 1 });
      resultado.fallidas++;
      continue;
    }
    await d.actualizar(item.seq, { error: r.error, intentos: item.intentos + 1 });
    resultado.parada = "transitorio";
    return resultado;
  }
  return resultado;
}

"use client";

import { useActionState } from "react";
import { guardarOrden, type OrdenFormState } from "@/app/(app)/ordenes/actions";
import {
  BotonEnviar,
  CamposOrden,
  MensajeForm,
  esListoOEntregado,
  useValoresOrden,
} from "@/components/ordenes/orden-campos";
import { useAutor } from "@/components/sync/autor-provider";
import type { OrdenFormValores } from "@/lib/orden-nueva";

/**
 * EDITAR una orden existente con la Server Action `guardarOrden` (requiere conexión). Los campos
 * sencillos viajan por su atributo `name`; las pertenencias y el mantenimiento, por inputs ocultos.
 * El servidor vuelve a validar todo.
 */
export function OrdenFormEditar({
  ordenId,
  valores: inicial,
  fechaEntrega,
}: {
  ordenId: string;
  valores: OrdenFormValores;
  /** ISO de la entrega, si ya fue entregada. */
  fechaEntrega: string | null;
}) {
  const { autor } = useAutor();
  const [estado, accion, pendiente] = useActionState<OrdenFormState, FormData>(guardarOrden, {});
  const { valores, cambiar } = useValoresOrden(inicial);

  return (
    <form action={accion} className="space-y-6">
      <input type="hidden" name="orden_id" value={ordenId} />
      <input type="hidden" name="autor" value={autor} />
      <input type="hidden" name="pertenencias" value={valores.pertenencias ? JSON.stringify(valores.pertenencias) : ""} />
      <input
        type="hidden"
        name="mantenimiento_meses"
        value={esListoOEntregado(valores) && valores.mantenimiento_meses ? String(valores.mantenimiento_meses) : ""}
      />

      <CamposOrden valores={valores} onCambio={cambiar} fechaEntrega={fechaEntrega} />

      {estado.error && <MensajeForm tipo="error" texto={estado.error} />}
      {estado.ok && <MensajeForm tipo="ok" texto={estado.ok} />}
      <BotonEnviar pendiente={pendiente} texto="Guardar cambios" />
    </form>
  );
}

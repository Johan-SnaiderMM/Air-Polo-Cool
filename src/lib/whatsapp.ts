// Plantillas y enlaces de WhatsApp. Módulo puro (sin dependencias de servidor):
// se puede usar en servidor y en cliente.

export type PlantillaWhatsApp = "recepcion" | "listo" | "entregado";

export type DatosMensaje = {
  cliente: string;
  /** "Chevrolet Spark 2018" */
  vehiculo: string;
  placa: string;
  /** URL pública completa del portal (/orden/[token]). */
  urlPublica: string;
  totalCobrado: number;
  /** Fecha fin de garantía ya formateada (opcional). */
  garantiaHasta?: string | null;
};

export const PLANTILLA_LABEL: Record<PlantillaWhatsApp, string> = {
  recepcion: "Recepción del vehículo",
  listo: "Vehículo listo",
  entregado: "Entrega y garantía",
};

const moneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** "Juan Pérez López" -> "Juan" (saludo más natural). */
function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] || nombre;
}

export function construirMensaje(plantilla: PlantillaWhatsApp, d: DatosMensaje): string {
  const nombre = primerNombre(d.cliente);
  const auto = `${d.vehiculo} (placa ${d.placa})`;

  switch (plantilla) {
    case "recepcion":
      return [
        `Hola ${nombre}, hemos recibido tu ${auto} en Polo Air Cool. ❄️`,
        `Iniciamos el diagnóstico y te mantendremos informado del avance.`,
        `Puedes seguir el estado de tu vehículo aquí: ${d.urlPublica}`,
      ].join("\n\n");

    case "listo": {
      const lineas = [
        `Hola ${nombre}, tu ${auto} está listo para entrega. ✅`,
        `Revisa el trabajo realizado, repuestos cambiados y tu garantía digital aquí: ${d.urlPublica}`,
      ];
      if (d.totalCobrado > 0) {
        lineas.push(`Total a cancelar: ${moneda.format(d.totalCobrado)}.`);
      }
      return lineas.join("\n\n");
    }

    case "entregado": {
      const lineas = [
        `Hola ${nombre}, gracias por confiar en Polo Air Cool. Entregamos tu ${auto}. 🙌`,
        d.garantiaHasta
          ? `Tu garantía digital está vigente hasta el ${d.garantiaHasta}. Consúltala aquí: ${d.urlPublica}`
          : `Puedes consultar el detalle del servicio aquí: ${d.urlPublica}`,
      ];
      return lineas.join("\n\n");
    }
  }
}

/** Solo dígitos, sin "+" (formato que esperan wa.me y las APIs). */
export function soloDigitos(telefonoE164: string): string {
  return telefonoE164.replace(/\D/g, "");
}

/** Enlace wa.me con el mensaje ya redactado. */
export function enlaceWhatsApp(telefonoE164: string, mensaje: string): string {
  return `https://wa.me/${soloDigitos(telefonoE164)}?text=${encodeURIComponent(mensaje)}`;
}

export function urlPublicaOrden(origen: string, token: string): string {
  return `${origen.replace(/\/+$/, "")}/orden/${token}`;
}

/** Recordatorio de garantía (por vencer o vencida). No necesita enlace del portal. */
export function mensajeGarantia(d: {
  cliente: string;
  placa: string;
  /** Fecha fin ya formateada, ej. "05 oct 2026". */
  fechaFin: string;
  diasRestantes: number;
}): string {
  const nombre = primerNombre(d.cliente);
  if (d.diasRestantes < 0) {
    return `Hola ${nombre}, te informamos que la garantía del servicio de tu vehículo (placa ${d.placa}) en Polo Air Cool venció el ${d.fechaFin}. Si necesitas una revisión, escríbenos y con gusto te atendemos. ❄️`;
  }
  const cuando =
    d.diasRestantes === 0
      ? "vence hoy"
      : `vence en ${d.diasRestantes} ${d.diasRestantes === 1 ? "día" : "días"} (${d.fechaFin})`;
  return `Hola ${nombre}, te recordamos que la garantía del servicio de tu vehículo (placa ${d.placa}) en Polo Air Cool ${cuando}. Si notas algo con el aire acondicionado, escríbenos para revisarlo mientras la garantía siga vigente. ❄️`;
}

/** Recordatorio de mantenimiento preventivo (formal, sin enlace). */
export function mensajeMantenimiento(d: {
  cliente: string;
  placa: string;
  /** "Chevrolet Spark GT 2018" */
  vehiculo: string;
}): string {
  const nombre = primerNombre(d.cliente);
  return `Hola ${nombre}, desde Polo Air Cool te recordamos que tu vehículo ${d.vehiculo} (placa ${d.placa}) está listo para su revisión preventiva del aire acondicionado. Escríbenos y agendamos tu cita. ❄️`;
}

/** Recordatorio amable de saldo pendiente. */
export function mensajeCobro(d: {
  cliente: string;
  placa: string;
  saldo: number;
}): string {
  const nombre = primerNombre(d.cliente);
  return `Hola ${nombre}, desde Polo Air Cool te recordamos que el servicio de tu vehículo (placa ${d.placa}) tiene un saldo pendiente de ${moneda.format(d.saldo)}. Puedes pagarlo en efectivo o por transferencia; cualquier duda, escríbenos. Gracias.`;
}

/** Resumen de una cotización para compartir por WhatsApp. */
export function mensajeCotizacion(d: {
  cliente: string;
  vehiculo: string;
  placa: string;
  manoObra: number;
  items: { descripcion: string; cantidad: number; precio_unitario: number }[];
  total: number;
  /** Fecha ya formateada, ej. "12 oct 2026". */
  vigenteHasta: string;
}): string {
  const nombre = primerNombre(d.cliente);
  const lineas = [
    `Hola ${nombre}, esta es tu cotización de Polo Air Cool para ${d.vehiculo} (placa ${d.placa}):`,
    "",
    ...d.items.map(
      (i) => `• ${i.cantidad} × ${i.descripcion}: ${moneda.format(Math.round(i.cantidad * i.precio_unitario))}`
    ),
  ];
  if (d.manoObra > 0) lineas.push(`• Mano de obra: ${moneda.format(d.manoObra)}`);
  lineas.push("", `Total: ${moneda.format(d.total)}`, `Válida hasta el ${d.vigenteHasta}.`, "", "Si estás de acuerdo, respóndenos y agendamos el trabajo. ❄️");
  return lineas.join("\n");
}

import { describe, expect, it } from "vitest";
import {
  construirMensaje,
  enlaceWhatsApp,
  mensajeCita,
  mensajeCotizacion,
  mensajeGarantia,
  mensajeMantenimiento,
  mensajePagoRecibido,
  soloDigitos,
  urlPublicaOrden,
} from "@/lib/whatsapp";

const base = {
  cliente: "Juan Pérez López",
  vehiculo: "Chevrolet Spark 2018",
  placa: "ABC123",
  urlPublica: "https://polo.example/orden/tok123",
  totalCobrado: 350000,
  garantiaHasta: "05 oct 2026",
};

describe("plantillas", () => {
  it("recepción: saluda por el primer nombre e incluye vehículo, placa y enlace", () => {
    const m = construirMensaje("recepcion", base);
    expect(m).toContain("Hola Juan,");
    expect(m).toContain("Chevrolet Spark 2018 (placa ABC123)");
    expect(m).toContain(base.urlPublica);
  });
  it("listo: incluye enlace y total a cancelar", () => {
    const m = construirMensaje("listo", base);
    expect(m).toContain("listo para entrega");
    expect(m).toContain(base.urlPublica);
    expect(m).toMatch(/Total a cancelar: .*350\.000/);
  });
  it("listo: omite el total si es 0", () => {
    expect(construirMensaje("listo", { ...base, totalCobrado: 0 })).not.toContain("Total a cancelar");
  });
  it("entregado: menciona la garantía cuando existe", () => {
    expect(construirMensaje("entregado", base)).toContain("05 oct 2026");
    expect(construirMensaje("entregado", { ...base, garantiaHasta: null })).not.toContain("garantía digital está vigente");
  });
  it("garantía: distingue por vencer y vencida", () => {
    const g = { cliente: "Ana Ruiz", placa: "XYZ987", fechaFin: "10 oct 2026" };
    expect(mensajeGarantia({ ...g, diasRestantes: 5 })).toContain("vence en 5 días");
    expect(mensajeGarantia({ ...g, diasRestantes: 1 })).toContain("vence en 1 día ");
    expect(mensajeGarantia({ ...g, diasRestantes: 0 })).toContain("vence hoy");
    expect(mensajeGarantia({ ...g, diasRestantes: -3 })).toContain("venció el 10 oct 2026");
  });
});

describe("enlaces", () => {
  it("wa.me usa solo dígitos y codifica el texto", () => {
    expect(soloDigitos("+57 300-123 4567")).toBe("573001234567");
    const url = enlaceWhatsApp("+573001234567", "Hola & adiós\nlínea 2");
    expect(url.startsWith("https://wa.me/573001234567?text=")).toBe(true);
    expect(url).toContain(encodeURIComponent("Hola & adiós\nlínea 2"));
  });
  it("url pública sin doble barra", () => {
    expect(urlPublicaOrden("https://polo.example/", "tok")).toBe("https://polo.example/orden/tok");
  });
});

describe('recordatorio de cita', () => {
  const d = { cliente: 'Juan Pérez López', vehiculo: 'Chevrolet Spark GT 2018', placa: 'ABC123', cuando: 'mañana a las 9:30 a. m.' };
  it('servicio: saluda por el primer nombre e incluye vehículo, placa y cuándo', () => {
    const m = mensajeCita({ ...d, tipo: 'servicio' });
    expect(m).toContain('Hola Juan,');
    expect(m).toContain('la revisión de tu Chevrolet Spark GT 2018 (placa ABC123)');
    expect(m).toContain('mañana a las 9:30 a. m.');
    expect(m).toContain('reprogramamos');
  });
  it('mantenimiento: lo dice como mantenimiento preventivo', () => {
    expect(mensajeCita({ ...d, tipo: 'mantenimiento' })).toContain('mantenimiento preventivo del aire acondicionado de tu Chevrolet Spark GT 2018');
  });
});

describe("pago completo: agradecimiento", () => {
  const d = { cliente: "Juan Pérez López", placa: "ABC123" };
  it("por transferencia: confirma que la transferencia ya llegó y agradece", () => {
    const m = mensajePagoRecibido({ ...d, porTransferencia: true });
    expect(m).toContain("Hola Juan, tu transferencia ya llegó. ✓");
    expect(m).toContain("(placa ABC123) quedó pagado en su totalidad");
    expect(m).toContain("Gracias por confiar en los servicios de Polo Air Cool");
  });
  it("sin transferencia: dice que se recibió el pago", () => {
    const m = mensajePagoRecibido({ ...d, porTransferencia: false });
    expect(m).toContain("Hola Juan, recibimos tu pago. ✓");
    expect(m).not.toContain("transferencia");
  });
});

describe("sin emojis modernos (en teléfonos viejos salen como «?»)", () => {
  // Emoticonos y pictogramas (U+1F000–1FAFF), ✅ (U+2705) y el selector de variación (U+FE0F).
  const moderno = /[\u{1F000}-\u{1FAFF}\u{2705}\u{FE0F}]/u;
  const f = "10 oct 2026";
  const textos: Record<string, string> = {
    recepcion: construirMensaje("recepcion", base),
    listo: construirMensaje("listo", base),
    entregado: construirMensaje("entregado", base),
    garantiaVencida: mensajeGarantia({ cliente: "Ana", placa: "X", fechaFin: f, diasRestantes: -1 }),
    garantiaPorVencer: mensajeGarantia({ cliente: "Ana", placa: "X", fechaFin: f, diasRestantes: 3 }),
    mantenimiento: mensajeMantenimiento({ cliente: "Ana", placa: "X", vehiculo: "Spark" }),
    cotizacion: mensajeCotizacion({ cliente: "Ana", vehiculo: "Spark", placa: "X", manoObra: 1, items: [], total: 1, vigenteHasta: f }),
    cita: mensajeCita({ cliente: "Ana", vehiculo: "Spark", placa: "X", cuando: "hoy", tipo: "servicio" }),
    pago: mensajePagoRecibido({ cliente: "Ana", placa: "X", porTransferencia: true }),
  };
  it.each(Object.entries(textos))("%s no lleva emojis modernos", (_nombre, texto) => {
    expect(texto).not.toMatch(moderno);
  });
  it("el visto del mensaje «listo» es ✓", () => {
    expect(textos.listo).toContain("listo para entrega. ✓");
  });
});

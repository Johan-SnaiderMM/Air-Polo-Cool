import { describe, expect, it } from "vitest";
import {
  construirMensaje,
  enlaceWhatsApp,
  mensajeCita,
  mensajeGarantia,
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

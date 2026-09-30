import { describe, expect, it } from "vitest";
import { autorONull, esAutor, inicialAutor } from "@/lib/autor";
import { comparar, desgloseLimpio, limpiarCantidad, totalDesglose } from "@/lib/arqueo";
import { celdaCsv, construirCsv } from "@/lib/csv";
import { ENCABEZADOS_LIBRO, filaALibroCsv, ordenarLibro, totalesLibro, type FilaLibro } from "@/lib/libro";
import { plantillasValidas, PLANTILLAS_POR_DEFECTO } from "@/lib/plantillas-gasto";
import { variacion } from "@/components/caja/grafico-categorias";
import { mensajeMantenimiento, mensajeCobro } from "@/lib/whatsapp";

describe("autoría", () => {
  it("solo Polo y Soporte técnico", () => {
    expect(esAutor("Polo")).toBe(true);
    expect(esAutor("Soporte técnico")).toBe(true);
    expect(esAutor("Admin")).toBe(false);
    expect(autorONull("Otro")).toBeNull();
    expect(inicialAutor("Soporte técnico")).toBe("S");
    expect(inicialAutor(null)).toBe("·");
  });
});

describe("arqueo", () => {
  it("suma billetes y monedas por denominación", () => {
    expect(totalDesglose({ "50000": 4, "20000": 1, "1000": 3, "500": 2 })).toBe(224000);
  });
  it("ignora denominaciones inexistentes y cantidades basura", () => {
    expect(totalDesglose({ "7": 10, "50000": -3, "20000": "x" as unknown as number })).toBe(0);
    expect(limpiarCantidad(2.9)).toBe(2);
    expect(limpiarCantidad("abc")).toBe(0);
    expect(desgloseLimpio({ "50000": 2, "9999": 5, "1000": 0 })).toEqual({ "50000": 2 });
    expect(desgloseLimpio(null)).toEqual({});
  });
  it("cuadrado / faltante / sobrante", () => {
    expect(comparar(205000, 205000)).toEqual({ diferencia: 0, resultado: "cuadrado" });
    expect(comparar(205000, 200000)).toEqual({ diferencia: -5000, resultado: "faltante" });
    expect(comparar(205000, 210000)).toEqual({ diferencia: 5000, resultado: "sobrante" });
  });
});

describe("CSV para Excel", () => {
  it("separador ; con BOM y CRLF", () => {
    const csv = construirCsv(["A", "B"], [["x", 1]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿A;B\r\nx;1\r\n");
  });
  it("escapa comillas, separadores y saltos de línea", () => {
    expect(celdaCsv('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(celdaCsv("a;b")).toBe('"a;b"');
    expect(celdaCsv("línea1\nlínea2")).toBe('"línea1\nlínea2"');
    expect(celdaCsv(null)).toBe("");
    expect(celdaCsv(true)).toBe("Sí");
  });
  it("neutraliza inyección de fórmulas (=, +, -, @)", () => {
    expect(celdaCsv("=CMD()")).toBe("'=CMD()");
    expect(celdaCsv("+57300")).toBe("'+57300");
    expect(celdaCsv("@x")).toBe("'@x");
  });
});

describe("libro de movimientos", () => {
  const f = (o: Partial<FilaLibro>): FilaLibro => ({
    fecha: "2026-09-01", creado: "2026-09-01T10:00:00Z", tipo: "Gasto", concepto: "Flete", descripcion: null,
    monto: 1000, sentido: "Salida", medio: "Efectivo (caja menor)", placa: null, autor: "Polo",
    anulado: false, motivoAnulacion: null, referencia: null, ...o,
  });
  it("ordena por fecha y, dentro del día, por creación", () => {
    const orden = ordenarLibro([f({ fecha: "2026-09-02" }), f({ creado: "2026-09-01T12:00:00Z", monto: 2 }), f({ monto: 1 })]);
    expect(orden.map((x) => x.monto)).toEqual([1, 2, 1000]);
  });
  it("marca anulados y trae las 12 columnas", () => {
    expect(ENCABEZADOS_LIBRO).toHaveLength(12);
    const fila = filaALibroCsv(f({ anulado: true, motivoAnulacion: "error" }));
    expect(fila).toHaveLength(12);
    expect(fila[9]).toBe("Anulado");
    expect(fila[10]).toBe("error");
  });
  it("los totales de control ignoran los anulados", () => {
    const t = totalesLibro([
      f({ sentido: "Entrada", monto: 500 }),
      f({ sentido: "Salida", monto: 200 }),
      f({ sentido: "Salida", monto: 999, anulado: true }),
      f({ sentido: "—", monto: 12345 }),
    ]);
    expect(t).toEqual({ entradas: 500, salidas: 200, neto: 300 });
  });
});

describe("plantillas de gasto", () => {
  it("valida lo leído del almacén local", () => {
    expect(plantillasValidas(null)).toEqual(PLANTILLAS_POR_DEFECTO);
    expect(plantillasValidas([{ id: "a", nombre: "X", monto: 5, categoria: "otros" }, { basura: true }, { id: "b", nombre: "Y", monto: -1, categoria: "otros" }])).toHaveLength(1);
  });
  it("trae las dos plantillas del taller por defecto", () => {
    expect(PLANTILLAS_POR_DEFECTO.map((p) => p.monto)).toEqual([15000, 5000]);
  });
});

describe("gráfico y mensajes", () => {
  it("variación contra el mes anterior", () => {
    expect(variacion(150, 100)).toBe(50);
    expect(variacion(50, 100)).toBe(-50);
    expect(variacion(10, 0)).toBeNull();
  });
  it("recordatorio de mantenimiento con el texto formal pedido", () => {
    const m = mensajeMantenimiento({ cliente: "Ana Ruiz", placa: "ABC123", vehiculo: "Chevrolet Spark GT 2018" });
    expect(m).toContain("Hola Ana, desde Polo Air Cool te recordamos que tu vehículo");
    expect(m).toContain("está listo para su revisión preventiva");
  });
  it("recordatorio de cobro con el saldo", () => {
    expect(mensajeCobro({ cliente: "Ana Ruiz", placa: "ABC123", saldo: 120000 })).toMatch(/saldo pendiente de .*120\.000/);
  });
});

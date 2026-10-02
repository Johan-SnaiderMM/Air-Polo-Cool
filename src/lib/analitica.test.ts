import { describe, expect, it } from "vitest";
import { filtrarEvento, limpiarUrl } from "@/lib/analitica";

const ID = "123e4567-e89b-12d3-a456-426614174000";
const TOKEN = "k3J9fQ2xLm0aPz8Rt5VwYb";

describe("limpiarUrl", () => {
  it("nunca mide el portal del cliente: su dirección lleva el token de acceso a la orden", () => {
    for (const url of [`https://taller.test/orden/${TOKEN}`, `/orden/${TOKEN}`, "https://taller.test/orden/", "/orden", `https://taller.test/orden/${TOKEN}?x=1#fotos`]) {
      expect(limpiarUrl(url), url).toBeNull();
    }
  });

  it("«/ordenes» (la lista del taller) NO es el portal y sí se mide", () => {
    expect(limpiarUrl("https://taller.test/ordenes")).toBe("https://taller.test/ordenes");
  });

  it("reemplaza los identificadores por un marcador para contar la pantalla, no la orden", () => {
    expect(limpiarUrl(`https://taller.test/ordenes/${ID}`)).toBe("https://taller.test/ordenes/:id");
    expect(limpiarUrl(`https://taller.test/ordenes/${ID.toUpperCase()}/comprobante`)).toBe("https://taller.test/ordenes/:id/comprobante");
    expect(limpiarUrl(`/vehiculos/${ID}`)).toBe("/vehiculos/:id");
    expect(limpiarUrl(`https://taller.test/x/${TOKEN}`)).toBe("https://taller.test/x/:token");
  });

  it("quita los parámetros y el fragmento (p. ej. ?next=/ordenes/<id> del login o ?vehiculo=<id>)", () => {
    expect(limpiarUrl(`https://taller.test/login?next=/ordenes/${ID}`)).toBe("https://taller.test/login");
    expect(limpiarUrl(`https://taller.test/ordenes/nueva?vehiculo=${ID}&cita=${ID}#x`)).toBe("https://taller.test/ordenes/nueva");
    expect(limpiarUrl("/caja-menor?mes=2026-09")).toBe("/caja-menor");
  });

  it("deja pasar las rutas normales tal cual (con y sin origen)", () => {
    expect(limpiarUrl("https://taller.test/")).toBe("https://taller.test/");
    expect(limpiarUrl("/agenda")).toBe("/agenda");
    expect(limpiarUrl("https://taller.test/legal/privacidad")).toBe("https://taller.test/legal/privacidad");
    expect(limpiarUrl("https://taller.test/ordenes/nueva")).toBe("https://taller.test/ordenes/nueva");
  });

  it("una dirección ilegible se descarta", () => {
    expect(limpiarUrl("http://[")).toBeNull();
  });
});

describe("filtrarEvento", () => {
  it("limpia la dirección y conserva el resto del evento; descarta lo que no se debe medir", () => {
    expect(filtrarEvento({ type: "pageview" as const, url: `https://taller.test/ordenes/${ID}?a=1` })).toEqual({ type: "pageview", url: "https://taller.test/ordenes/:id" });
    expect(filtrarEvento({ type: "pageview" as const, url: `https://taller.test/orden/${TOKEN}` })).toBeNull();
  });
});

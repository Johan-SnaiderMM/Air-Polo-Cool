import { describe, expect, it } from "vitest";
import { armarFormularioOperacion, extensionDe } from "@/lib/offline/envio";
import type { Operacion } from "@/lib/offline/operaciones";

const gasto: Operacion = {
  tipo: "gasto.crear",
  datos: { id: "123e4567-e89b-12d3-a456-426614174000", fecha: "2026-09-29", monto: 15000, categoria: "otros", descripcion: null, orden_id: null, autor: "Polo" },
};

describe("armarFormularioOperacion", () => {
  it("lleva la operación como JSON en `op` y nada más si no hay imagen", () => {
    const fd = armarFormularioOperacion(gasto);
    expect(JSON.parse(String(fd.get("op")))).toEqual(gasto);
    expect(fd.has("archivo")).toBe(false);
    expect(armarFormularioOperacion(gasto, null).has("archivo")).toBe(false);
  });

  it("adjunta la imagen como archivo con su tipo y una extensión coherente", async () => {
    const webp = armarFormularioOperacion(gasto, new Blob([new Uint8Array(8)], { type: "image/webp" })).get("archivo") as File;
    expect(webp).toBeInstanceOf(File);
    expect(webp.name).toBe("adjunto.webp");
    expect(webp.type).toBe("image/webp");
    expect(webp.size).toBe(8);
    const jpg = armarFormularioOperacion(gasto, new Blob(["x"], { type: "image/jpeg" })).get("archivo") as File;
    expect(jpg.name).toBe("adjunto.jpg");
  });

  it("extensionDe: JPEG → jpg; cualquier otra cosa → webp", () => {
    expect(extensionDe(new Blob([], { type: "image/jpeg" }))).toBe("jpg");
    expect(extensionDe(new Blob([], { type: "image/webp" }))).toBe("webp");
    expect(extensionDe(new Blob([], { type: "" }))).toBe("webp");
  });
});

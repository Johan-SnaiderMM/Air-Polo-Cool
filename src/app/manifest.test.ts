import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("manifiesto de la app instalada", () => {
  const m = manifest();

  it("la pantalla de carga usa el azul marino del icono maskable, para que el marco del icono no se vea", () => {
    // El icono public/icons/maskable-512.png tiene fondo rgb(11, 22, 51) = #0b1633. Si se cambia uno, hay que cambiar el otro.
    expect(m.background_color).toBe("#0b1633");
    expect(m.icons?.some((i) => i.purpose === "maskable" && i.src === "/icons/maskable-512.png")).toBe(true);
  });

  it("sigue siendo una app instalable de pantalla completa", () => {
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.icons?.filter((i) => i.purpose === "any")).toHaveLength(2);
  });
});

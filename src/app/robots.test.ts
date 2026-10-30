import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("robots.txt", () => {
  const reglas = [robots().rules].flat();

  it("bloquea todo el sitio a todos los rastreadores (es una aplicación privada)", () => {
    expect(reglas).toContainEqual({ userAgent: "*", disallow: "/" });
  });

  it("solo deja leer la vista previa a LinkedInBot (no es un buscador)", () => {
    const abiertos = reglas.filter((r) => r.allow);
    expect(abiertos).toEqual([{ userAgent: "LinkedInBot", allow: "/" }]);
  });
});

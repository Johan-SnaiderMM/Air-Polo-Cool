import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Los cuadros del navegador (`window.confirm`, `alert`, `prompt`) se ven grises y ajenos a la app. Toda
 * confirmación usa `useConfirmar()` (src/components/ui/confirmar.tsx). Si alguien vuelve a poner uno, falla aquí.
 */
const RAIZ = join(process.cwd(), "src");

function archivos(dir: string, salida: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) archivos(ruta, salida);
    else salida.push(ruta);
  }
  return salida;
}

describe("diálogos propios", () => {
  it("ningún componente usa window.confirm / alert / prompt", () => {
    const usos = archivos(RAIZ)
      .filter((f) => /\.(tsx?)$/.test(f) && !/\.test\./.test(f))
      .flatMap((f) =>
        readFileSync(f, "utf8")
          .split("\n")
          .flatMap((linea, i) => {
            const codigo = linea.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
            return /\b(window\.)?(confirm|alert|prompt)\s*\(/.test(codigo) ? [`${relative(RAIZ, f)}:${i + 1}`] : [];
          })
      );
    expect(usos).toEqual([]);
  });
});

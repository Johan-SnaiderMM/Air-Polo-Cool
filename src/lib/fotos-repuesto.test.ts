import { describe, expect, it } from "vitest";
import { agruparPorRepuesto } from "@/lib/fotos-repuesto";

const R = (id: string, nombre: string) => ({ id, nombre });
const F = (n: number, tipo: string, rep?: string | null) => ({ n, tipo, orden_repuesto_id: rep });

describe("agruparPorRepuesto", () => {
  const repuestos = [R("a", "Compresor"), R("b", "Filtro"), R("c", "Válvula")];

  it("empareja retirado e instalado de cada repuesto, en el orden de la lista", () => {
    const { grupos, sueltas } = agruparPorRepuesto(
      [F(1, "repuesto_nuevo", "b"), F(2, "repuesto_viejo", "a"), F(3, "repuesto_nuevo", "a"), F(4, "repuesto_viejo", "b")],
      repuestos
    );
    expect(sueltas).toEqual([]);
    expect(grupos.map((g) => g.repuesto.nombre)).toEqual(["Compresor", "Filtro"]);
    expect(grupos[0].retirado.map((f) => f.n)).toEqual([2]);
    expect(grupos[0].instalado.map((f) => f.n)).toEqual([3]);
    expect(grupos[1].retirado.map((f) => f.n)).toEqual([4]);
    expect(grupos[1].instalado.map((f) => f.n)).toEqual([1]);
  });

  it("no crea grupo para repuestos sin fotos", () => {
    const { grupos } = agruparPorRepuesto([F(1, "repuesto_viejo", "a")], repuestos);
    expect(grupos).toHaveLength(1);
  });

  it("deja sueltas las fotos sin asignar, de otro tipo o de un repuesto que ya no está", () => {
    const { grupos, sueltas } = agruparPorRepuesto(
      [F(1, "repuesto_viejo", null), F(2, "repuesto_nuevo"), F(3, "ingreso", "a"), F(4, "repuesto_viejo", "z")],
      repuestos
    );
    expect(grupos).toEqual([]);
    expect(sueltas.map((f) => f.n)).toEqual([1, 2, 3, 4]);
  });

  it("admite varias fotos del mismo lado y repuestos sin id (antes de la fase 5)", () => {
    const { grupos, sueltas } = agruparPorRepuesto(
      [F(1, "repuesto_viejo", "a"), F(2, "repuesto_viejo", "a")],
      [R("a", "Compresor"), { nombre: "Sin id" }] as { id?: string; nombre: string }[]
    );
    expect(grupos[0].retirado).toHaveLength(2);
    expect(sueltas).toEqual([]);
  });
});

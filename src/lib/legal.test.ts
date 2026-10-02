import { describe, expect, it } from "vitest";
import { avisoLegal, canalesContacto, identificacionResponsable, politicaPrivacidad, RESPONSABLE, type DocumentoLegal } from "@/lib/legal";

const completo = { razonSocial: "Polo Servicios SAS", nit: "900.123.456-7", direccion: "Cra 1 # 2-3, Bogotá", correo: "datos@polo.example" };
const todo = (d: DocumentoLegal) => [d.introduccion, ...d.secciones.flatMap((s) => [s.titulo, ...s.parrafos, ...(s.lista ?? [])])].join("\n");

describe.each([
  ["política de privacidad", politicaPrivacidad()],
  ["aviso legal", avisoLegal()],
])("%s", (_nombre, doc) => {
  it("tiene título, introducción y secciones con identificador único, numeradas y con texto", () => {
    expect(doc.titulo).toBeTruthy();
    expect(doc.introduccion.length).toBeGreaterThan(40);
    const ids = doc.secciones.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    doc.secciones.forEach((s, i) => {
      expect(s.titulo.startsWith(`${i + 1}. `), s.titulo).toBe(true);
      expect(s.parrafos.length, s.id).toBeGreaterThan(0);
      for (const p of s.parrafos) expect(p.trim(), s.id).not.toBe("");
    });
  });

  it("no deja textos a medias: sin «undefined», «null», llaves ni marcadores por completar", () => {
    expect(todo(doc)).not.toMatch(/undefined|null|\[\s*\]|\{|\}|POR COMPLETAR|TODO/i);
  });
});

describe("política de privacidad: lo que exige la Ley 1581 de 2012", () => {
  const texto = todo(politicaPrivacidad());

  it("identifica al responsable y da un canal de contacto (el teléfono del taller siempre está)", () => {
    expect(texto).toMatch(/responsable del tratamiento/i);
    expect(texto).toMatch(/313 853 9617/);
  });

  it("explica qué datos, para qué, con quién se comparten y el tratamiento fuera de Colombia", () => {
    for (const clave of ["WhatsApp", "placa", "Supabase", "Vercel", "fuera de Colombia", "finalidades|Para qué los usamos", "autorización"]) {
      expect(texto, clave).toMatch(new RegExp(clave, "i"));
    }
  });

  it("aclara que quien desarrolla la plataforma actúa como encargado: solo accede por soporte, no para fines propios", () => {
    expect(texto).toMatch(/desarrolla, mantiene y da soporte/);
    expect(texto).toMatch(/únicamente para prestar ese soporte/);
    expect(texto).toMatch(/no los usa para fines propios/);
  });

  it("recoge los derechos del titular, el canal de la SIC y los plazos legales (10 y 15 días hábiles)", () => {
    expect(texto).toMatch(/Ley 1581 de 2012/);
    expect(texto).toMatch(/Superintendencia de Industria y Comercio/);
    expect(texto).toMatch(/10 días hábiles/);
    expect(texto).toMatch(/15 días hábiles/);
    for (const derecho of ["Conocer, actualizar y rectificar", "Revocar la autorización", "supresión"]) expect(texto, derecho).toContain(derecho);
  });

  it("dice la verdad sobre el enlace de seguimiento: no muestra teléfono ni documento", () => {
    expect(texto).toMatch(/no muestra tu teléfono, tu documento/);
  });

  it("aclara que no usa cookies de publicidad ni de seguimiento de terceros", () => {
    expect(texto).toMatch(/No usamos cookies de publicidad/);
  });
});

describe("datos del responsable", () => {
  it("sin datos completos se omiten (no aparece un hueco) y siempre queda el teléfono del taller", () => {
    expect(identificacionResponsable({ razonSocial: null, nit: null, direccion: null, correo: null })).toBe("Polo Air Cool");
    expect(canalesContacto({ razonSocial: null, nit: null, direccion: null, correo: null })).toBe("teléfono o WhatsApp 313 853 9617");
  });

  it("con los datos completos los incluye en el texto", () => {
    expect(identificacionResponsable(completo)).toBe("Polo Air Cool (Polo Servicios SAS, NIT 900.123.456-7, Cra 1 # 2-3, Bogotá)");
    expect(canalesContacto(completo)).toBe("teléfono o WhatsApp 313 853 9617 o correo datos@polo.example");
    const texto = todo(politicaPrivacidad(completo));
    expect(texto).toContain("datos@polo.example");
    expect(texto).toContain("NIT 900.123.456-7");
  });

  it("la configuración por defecto existe y todos sus campos son opcionales", () => {
    expect(Object.keys(RESPONSABLE).sort()).toEqual(["correo", "direccion", "nit", "razonSocial"]);
  });
});

describe("aviso legal", () => {
  it("remite a la política de privacidad y fija la ley colombiana", () => {
    const texto = todo(avisoLegal());
    expect(texto).toMatch(/Política de privacidad/);
    expect(texto).toMatch(/República de Colombia/);
  });
});

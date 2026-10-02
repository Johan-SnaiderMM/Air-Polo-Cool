import { describe, expect, it } from "vitest";
import { ipDeCliente, mensajeBloqueo, normalizarCorreo, POLITICA_LOGIN } from "@/lib/login-limite";

const cabeceras = (obj: Record<string, string>) => new Headers(obj);

describe("política", () => {
  it("el par (correo + IP) es el más estricto, luego el correo y por último la IP", () => {
    expect(POLITICA_LOGIN.par.max).toBeLessThan(POLITICA_LOGIN.correo.max);
    expect(POLITICA_LOGIN.correo.max).toBeLessThan(POLITICA_LOGIN.ip.max);
    for (const l of Object.values(POLITICA_LOGIN)) {
      expect(l.bloqueoSeg).toBeGreaterThan(0);
      expect(l.ventanaSeg).toBeGreaterThanOrEqual(l.bloqueoSeg); // si no, un bloqueo vencido dejaría fallos viejos sin reiniciar
    }
  });
});

describe("normalizarCorreo", () => {
  it("quita espacios y pasa a minúsculas", () => {
    expect(normalizarCorreo("  Polo@Example.COM ")).toBe("polo@example.com");
  });
});

describe("ipDeCliente", () => {
  it("toma la primera de x-forwarded-for (la del cliente) y, si no, x-real-ip", () => {
    expect(ipDeCliente(cabeceras({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" }))).toBe("203.0.113.7");
    expect(ipDeCliente(cabeceras({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(ipDeCliente(cabeceras({ "x-forwarded-for": " 2001:db8::1 " }))).toBe("2001:db8::1");
  });

  it("sin cabeceras, o con algo que no parece una IP, es null (así no se guarda basura ni se inyecta texto)", () => {
    expect(ipDeCliente(cabeceras({}))).toBeNull();
    for (const basura of ["unknown", "'; drop table x;--", "a".repeat(80), "", ","]) {
      expect(ipDeCliente(cabeceras({ "x-forwarded-for": basura })), basura).toBeNull();
    }
  });
});

describe("mensajeBloqueo", () => {
  const ahora = new Date("2026-10-02T15:00:00Z");
  const en = (segundos: number) => new Date(ahora.getTime() + segundos * 1000);

  it("redondea los minutos hacia arriba, con un mínimo de 1, y concuerda singular y plural", () => {
    expect(mensajeBloqueo(en(900), ahora)).toContain("espera 15 minutos ");
    expect(mensajeBloqueo(en(61), ahora)).toContain("espera 2 minutos ");
    expect(mensajeBloqueo(en(60), ahora)).toContain("espera 1 minuto ");
    expect(mensajeBloqueo(en(5), ahora)).toContain("espera 1 minuto ");
    expect(mensajeBloqueo(en(-30), ahora)).toContain("espera 1 minuto ");
  });

  it("no menciona ningún correo ni dice si la cuenta existe", () => {
    expect(mensajeBloqueo(en(600), ahora)).not.toMatch(/correo|cuenta|usuario/i);
  });
});

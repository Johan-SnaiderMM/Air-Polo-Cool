import { describe, expect, it } from "vitest";
import { claveVapidABytes, disponibilidadAvisos, mensajeErrorAvisos } from "@/lib/push/cliente";

describe("claveVapidABytes", () => {
  it("convierte la clave pública (base64url, sin relleno) a los bytes que pide el navegador", () => {
    // 65 bytes 0x04 + ... en base64url: se comprueba con una cadena conocida.
    expect(Array.from(claveVapidABytes("AQID"))).toEqual([1, 2, 3]);
    expect(Array.from(claveVapidABytes("-_8"))).toEqual([251, 255]); // «-» y «_» valen «+» y «/»
    expect(claveVapidABytes("").length).toBe(0);
  });

  it("una clave VAPID real (87 caracteres) da 65 bytes y empieza por 0x04 (punto sin comprimir)", () => {
    const real = "BEl62iUYgUivxIkv69yViEuiBIa-ZEWBy5ArzT-mHRC5wH1G3vdHB5eKA9eUJy3cZ5oQ6S2oY-MjYy1kQGv7lSU";
    const bytes = claveVapidABytes(real);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(4);
  });
});

describe("disponibilidadAvisos", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";
  const android = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";

  it("en iPhone solo funciona con la app instalada en la pantalla de inicio", () => {
    expect(disponibilidadAvisos({ agente: iphone, instalada: false, conPush: false })).toBe("instalar_en_inicio");
    expect(disponibilidadAvisos({ agente: iphone, instalada: false, conPush: true })).toBe("instalar_en_inicio");
    expect(disponibilidadAvisos({ agente: iphone, instalada: true, conPush: true })).toBe("disponible");
  });

  it("en Android basta con que el navegador lo soporte, instalada o no", () => {
    expect(disponibilidadAvisos({ agente: android, instalada: false, conPush: true })).toBe("disponible");
    expect(disponibilidadAvisos({ agente: android, instalada: true, conPush: true })).toBe("disponible");
    expect(disponibilidadAvisos({ agente: android, instalada: false, conPush: false })).toBe("no_soportado");
  });
});

describe("mensajeErrorAvisos", () => {
  it("el «push service error» del navegador se traduce a qué hacer (conexión, Chrome, permiso dado a mano)", () => {
    const abort = Object.assign(new Error("Registration failed - push service error"), { name: "AbortError" });
    expect(mensajeErrorAvisos(abort)).toMatch(/datos móviles/);
    expect(mensajeErrorAvisos(abort)).toMatch(/permiso de notificaciones a mano/);
    expect(mensajeErrorAvisos(new Error("Registration failed - push service error"))).toMatch(/servicio de avisos/);
  });

  it("otros errores conservan su mensaje; sin mensaje, uno genérico", () => {
    expect(mensajeErrorAvisos(new Error("Tu sesión expiró."))).toBe("Tu sesión expiró.");
    expect(mensajeErrorAvisos("raro")).toBe("No se pudieron activar los avisos.");
  });
});

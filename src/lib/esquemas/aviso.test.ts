import { describe, expect, it } from "vitest";
import { validar } from "@/lib/esquemas/comunes";
import { MSG_SUSCRIPCION, suscripcionSchema } from "@/lib/esquemas/aviso";

const bien = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  expirationTime: null,
  keys: { p256dh: "BEl62iUYgUivxIkv69yViEuiBIa-ZEWBy5ArzT-mHRC5wH1G3vdHB5eKA9eUJy3cZ5oQ6S2oY-MjYy1kQGv7lSU", auth: "tBHItJI5svbpez7KI4CCXg" },
};
const error = (r: { ok: boolean; error?: string }) => (r.ok ? null : r.error);

describe("suscripción a los avisos", () => {
  it("acepta lo que entrega el navegador y se queda solo con endpoint y claves", () => {
    expect(validar(suscripcionSchema, bien)).toEqual({ ok: true, valor: { endpoint: bien.endpoint, keys: bien.keys } });
  });

  it("rechaza direcciones que no son https, vacías, enormes o que no son texto", () => {
    for (const endpoint of ["http://insegura.example/x", "ftp://x.example", "no es url", "", 5, null, undefined, `https://x.example/${"a".repeat(2100)}`]) {
      expect(error(validar(suscripcionSchema, { ...bien, endpoint })), String(endpoint).slice(0, 30)).toBe(MSG_SUSCRIPCION);
    }
  });

  it("rechaza claves ausentes, con caracteres raros o desproporcionadas", () => {
    for (const keys of [undefined, null, {}, { p256dh: bien.keys.p256dh }, { auth: bien.keys.auth }, { p256dh: "'; drop table", auth: bien.keys.auth }, { p256dh: bien.keys.p256dh, auth: "x" }, { p256dh: "a".repeat(300), auth: bien.keys.auth }]) {
      expect(error(validar(suscripcionSchema, { ...bien, keys })), JSON.stringify(keys)?.slice(0, 40)).toBe(MSG_SUSCRIPCION);
    }
  });
});

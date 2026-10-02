import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/avisos/route";
import { enviarResumenDiario } from "@/lib/push/aviso-diario";
import { createAdminClient } from "@/utils/supabase/admin";

vi.mock("@/lib/push/aviso-diario", () => ({ enviarResumenDiario: vi.fn() }));
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const SECRETO = "secreto-del-programador";
const pedir = (franja: string | null, autorizacion: string | null = `Bearer ${SECRETO}`) =>
  GET(
    new NextRequest(`https://taller.test/api/cron/avisos${franja === null ? "" : `?franja=${franja}`}`, {
      headers: autorizacion === null ? {} : { authorization: autorizacion },
    })
  );

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRETO);
  vi.mocked(enviarResumenDiario).mockReset().mockResolvedValue({ estado: "nada_que_avisar" });
  vi.mocked(createAdminClient).mockReset().mockReturnValue({} as never);
});

describe("/api/cron/avisos", () => {
  it("sin el secreto correcto no hace nada (401), ni aunque la franja sea válida", async () => {
    for (const autorizacion of [null, "", "Bearer otro", SECRETO, `bearer ${SECRETO}`, `Bearer ${SECRETO}x`]) {
      const r = await pedir("dia", autorizacion);
      expect(r.status, String(autorizacion)).toBe(401);
    }
    expect(enviarResumenDiario).not.toHaveBeenCalled();
  });

  it("si el servidor no tiene CRON_SECRET configurado, rechaza todo (nunca queda abierto)", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await pedir("dia", "Bearer ")).status).toBe(401);
    expect((await pedir("dia", "")).status).toBe(401);
    expect(enviarResumenDiario).not.toHaveBeenCalled();
  });

  it("solo acepta las franjas «dia» y «tarde»", async () => {
    for (const franja of [null, "noche", "", "DIA"]) {
      expect((await pedir(franja)).status, String(franja)).toBe(400);
    }
    expect(enviarResumenDiario).not.toHaveBeenCalled();
  });

  it("con el secreto y una franja válida envía el resumen y devuelve el resultado", async () => {
    vi.mocked(enviarResumenDiario).mockResolvedValue({ estado: "sin_suscripciones" });
    const r = await pedir("tarde");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ estado: "sin_suscripciones" });
    expect(vi.mocked(enviarResumenDiario).mock.calls[0][1]).toBe("tarde");
  });

  it("sin la clave de servicio de Supabase avisa con un 500 claro", async () => {
    vi.mocked(createAdminClient).mockReturnValue(null);
    const r = await pedir("dia");
    expect(r.status).toBe(500);
    expect((await r.json()).error).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("si el envío falla devuelve 500 con el motivo (el programador lo registra)", async () => {
    vi.mocked(enviarResumenDiario).mockRejectedValue(new Error("falló la base"));
    const r = await pedir("dia");
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: "falló la base" });
  });
});

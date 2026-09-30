"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, CloudUpload, ExternalLink, Loader2, X } from "lucide-react";
import { anularPago } from "@/app/(app)/ordenes/pagos-actions";
import { useAutor } from "@/components/sync/autor-provider";
import { useSync } from "@/components/sync/sync-provider";
import { Dinero } from "@/components/ui/dinero";
import { FormularioAnulacion } from "@/components/ui/dialogo-motivo";
import { Drawer } from "@/components/ui/drawer";
import { PosMonto } from "@/components/ui/pos-monto";
import { SelectorFecha } from "@/components/ui/selector-fecha";
import { etiquetaDia, hoyBogota } from "@/lib/caja";
import { comprimirImagen } from "@/lib/imagen";
import { MEDIOS_PAGO, nuevoId } from "@/lib/offline/operaciones";
import { formatearMoneda } from "@/lib/ordenes";
import type { Autor, EstadoOrden, MedioPago } from "@/types/database";

export type PagoVista = {
  id: string;
  fecha: string;
  monto: number;
  medio: MedioPago;
  esDevolucion: boolean;
  referencia: string | null;
  notas: string | null;
  autor: Autor | null;
  anulado: boolean;
  anuladoMotivo: string | null;
  comprobanteUrl: string | null;
};

const MEDIO_LABEL: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  otro: "Otro",
};

const ESTADO_PAGO = {
  pagado: { texto: "Pagado", clase: "bg-sage-100 text-sage-800" },
  parcial: { texto: "Abonado", clase: "bg-ochre-100 text-ochre-800" },
  pendiente: { texto: "Sin pagos", clase: "bg-stone-100 text-stone-600" },
  sobrepago: { texto: "Pagó de más", clase: "bg-dusk-100 text-dusk-800" },
} as const;

type Props = {
  ordenId: string;
  estadoOrden: EstadoOrden;
  totalCobrado: number;
  pagos: PagoVista[];
};

/**
 * Pagos y abonos ligados a la orden. El saldo por cobrar sale de aquí: nunca se
 * asume que el total de la orden está pagado. El medio (efectivo, transferencia…)
 * solo sirve para saber cómo entró la plata: se resume en Caja › Cobros.
 * Registrar funciona sin conexión; anular requiere conexión.
 */
export function PagosOrden({ ordenId, estadoOrden, totalCobrado, pagos }: Props) {
  const { registrar, online } = useSync();
  const { autor } = useAutor();
  const inputFoto = useRef<HTMLInputElement>(null);

  const vigentes = pagos.filter((p) => !p.anulado);
  const pagado = vigentes.reduce((s, p) => s + (p.esDevolucion ? -p.monto : p.monto), 0);
  const saldo = totalCobrado - pagado;
  const clave =
    totalCobrado > 0 && pagado > totalCobrado
      ? "sobrepago"
      : totalCobrado > 0 && pagado === totalCobrado
        ? "pagado"
        : pagado > 0
          ? "parcial"
          : "pendiente";
  const avance = totalCobrado > 0 ? Math.max(0, Math.min(100, (pagado / totalCobrado) * 100)) : 0;

  const [digitos, setDigitos] = useState("");
  const [medio, setMedio] = useState<MedioPago>("efectivo");
  const [referencia, setReferencia] = useState("");
  const [fecha, setFecha] = useState(hoyBogota);
  const [devolucion, setDevolucion] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ tipo: "ok" | "cola" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [anulando, setAnulando] = useState<PagoVista | null>(null);
  const cerrarAnulacion = useCallback(() => setAnulando(null), []);

  const monto = Number(digitos || "0");
  const excede = !devolucion && totalCobrado > 0 && monto > Math.max(0, saldo);

  function quitarFoto() {
    if (previa) URL.revokeObjectURL(previa);
    setFoto(null);
    setPrevia(null);
  }

  function guardar() {
    if (monto <= 0) return;
    setResultado(null);
    iniciar(async () => {
      try {
        let blob: Blob | null = null;
        let extension: "webp" | "jpg" | undefined;
        if (foto) {
          const c = await comprimirImagen(foto);
          blob = c.blob;
          extension = c.extension;
        }
        const r = await registrar(
          {
            tipo: "pago.crear",
            conArchivo: blob !== null,
            extension,
            datos: {
              id: nuevoId(),
              orden_id: ordenId,
              fecha,
              monto,
              medio,
              es_devolucion: devolucion,
              referencia: referencia.trim() || null,
              notas: null,
              autor,
            },
          },
          blob
        );
        if (r.estado === "error") {
          setResultado({ tipo: "error", texto: r.error });
          return;
        }
        setResultado({
          tipo: r.estado === "sincronizado" ? "ok" : "cola",
          texto:
            r.estado === "sincronizado"
              ? `${devolucion ? "Devolución" : "Abono"} de ${formatearMoneda(monto)} registrado.`
              : `${devolucion ? "Devolución" : "Abono"} guardado en el teléfono; se subirá al volver la conexión.`,
        });
        setDigitos("");
        setReferencia("");
        setDevolucion(false);
        setFecha(hoyBogota());
        quitarFoto();
      } catch (err) {
        setResultado({
          tipo: "error",
          texto: err instanceof Error ? err.message : "No se pudo registrar el pago.",
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* ---------- Resumen de saldo ---------- */}
      <div className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-stone-500">Saldo por cobrar</p>
          <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${ESTADO_PAGO[clave].clase}`}>
            {ESTADO_PAGO[clave].texto}
          </span>
        </div>
        <p className={`mt-1 text-3xl ${saldo > 0 && estadoOrden === "entregado" ? "text-ochre-700" : ""}`}>
          <Dinero valor={saldo} />
        </p>
        <div className="mt-3 h-1.5 rounded-full bg-stone-100" role="img" aria-label={`Pagado ${Math.round(avance)} %`}>
          <div className="h-1.5 rounded-full bg-sage-500" style={{ width: `${avance}%` }} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
          <div>
            <dt className="text-stone-500">Total de la orden</dt>
            <dd>
              <Dinero valor={totalCobrado} />
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-stone-500">Pagado</dt>
            <dd>
              <Dinero valor={pagado} />
            </dd>
          </div>
        </dl>
        {totalCobrado <= 0 && (
          <p className="mt-2 text-[12px] text-stone-500">
            La orden aún no tiene total cobrado: puedes registrar un anticipo de todas formas.
          </p>
        )}
      </div>

      {/* ---------- Lista de pagos ---------- */}
      {pagos.length > 0 && (
        <ul className="divide-y divide-stone-200/70 overflow-hidden rounded-2xl border border-stone-200/70 bg-white">
          {pagos.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className={`text-[15px] font-medium ${p.anulado ? "text-stone-400 line-through" : ""}`}>
                  {p.esDevolucion ? "Devolución" : "Abono"} · {MEDIO_LABEL[p.medio]}
                  {p.anulado && (
                    <span className="ml-2 rounded-full bg-brick-50 px-2 py-0.5 align-middle text-[11px] font-medium text-brick-700 no-underline">
                      Anulado
                    </span>
                  )}
                </p>
                <p className="truncate text-[13px] text-stone-500">
                  {etiquetaDia(p.fecha)}
                  {p.referencia ? ` · Ref. ${p.referencia}` : ""}
                  {p.autor ? ` · ${p.autor}` : ""}
                  {p.anulado && p.anuladoMotivo ? ` · ${p.anuladoMotivo}` : ""}
                </p>
              </div>
              <p className={`shrink-0 text-[15px] ${p.anulado ? "text-stone-400 line-through" : p.esDevolucion ? "text-brick-700" : ""}`}>
                {p.esDevolucion ? "−" : ""}
                <Dinero valor={p.monto} />
              </p>
              {p.comprobanteUrl && (
                <a
                  href={p.comprobanteUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Ver comprobante"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-stone-400 active:text-ink"
                >
                  <ExternalLink className="size-4" strokeWidth={1.5} aria-hidden />
                </a>
              )}
              {!p.anulado && (
                <button
                  type="button"
                  disabled={!online}
                  onClick={() => setAnulando(p)}
                  className="shrink-0 px-1 text-[13px] text-stone-400 underline underline-offset-2 hover:text-brick-600 disabled:opacity-40"
                >
                  Anular
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ---------- Registrar abono ---------- */}
      <div className="space-y-3 rounded-2xl border border-stone-200/70 bg-white p-4">
        <PosMonto
          id="pago-monto"
          etiqueta={devolucion ? "Monto a devolver" : "Monto del abono"}
          digitos={digitos}
          onChange={setDigitos}
          tamano="normal"
        />
        {saldo > 0 && !devolucion && (
          <button
            type="button"
            onClick={() => setDigitos(String(Math.round(saldo)))}
            className="text-[13px] text-stone-500 underline underline-offset-2 active:text-ink"
          >
            Pagar el saldo completo ({formatearMoneda(saldo)})
          </button>
        )}

        <div role="radiogroup" aria-label="Medio de pago" className="grid grid-cols-4 gap-2">
          {MEDIOS_PAGO.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={medio === m}
              onClick={() => setMedio(m)}
              className={`h-11 rounded-xl border-[1.5px] text-[12px] transition-colors ${
                medio === m
                  ? "border-ink bg-stone-100 font-medium text-ink"
                  : "border-stone-200/80 bg-white text-stone-500 active:bg-stone-50"
              }`}
            >
              {MEDIO_LABEL[m]}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-stone-500">
          {medio === "efectivo"
            ? "Se registra como cobro en efectivo."
            : "Se registra como cobro por " + MEDIO_LABEL[medio].toLowerCase() + " (queda en el banco / datáfono)."}
        </p>

        {medio !== "efectivo" && (
          <input
            aria-label="Referencia (opcional)"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            maxLength={120}
            placeholder={medio === "transferencia" ? "Nº de transferencia / Bancolombia (opcional)" : "Referencia (opcional)"}
            className="h-12 w-full rounded-xl border border-stone-200/80 bg-white px-4 text-[15px] outline-none focus:border-stone-400"
          />
        )}

        <div className="flex items-center justify-between gap-3">
          <SelectorFecha value={fecha} onChange={setFecha} />
          <div>
            <input
              ref={inputFoto}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                e.target.value = "";
                if (!archivo) return;
                if (previa) URL.revokeObjectURL(previa);
                setFoto(archivo);
                setPrevia(URL.createObjectURL(archivo));
              }}
            />
            {previa ? (
              <div className="relative size-10">
                {/* Vista previa local (blob:): next/image no aplica. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previa} alt="Comprobante" className="size-10 rounded-lg border border-stone-200/80 object-cover" />
                <button
                  type="button"
                  onClick={quitarFoto}
                  aria-label="Quitar comprobante"
                  className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-white"
                >
                  <X className="size-3" strokeWidth={2.5} aria-hidden />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputFoto.current?.click()}
                className="flex h-10 items-center gap-1.5 rounded-lg border border-stone-200/80 bg-stone-50 px-3 text-[13px] font-medium text-stone-700 active:bg-stone-100"
              >
                <Camera className="size-4" strokeWidth={1.5} aria-hidden /> Comprobante
              </button>
            )}
          </div>
        </div>

        <label className="flex items-center gap-2 text-[13px] text-stone-600">
          <input
            type="checkbox"
            checked={devolucion}
            onChange={(e) => setDevolucion(e.target.checked)}
            className="size-4 accent-[#0b1633]"
          />
          Es una devolución de dinero al cliente
        </label>

        {excede && (
          <p className="rounded-lg bg-ochre-50 px-3 py-2 text-[13px] text-ochre-800">
            Este abono supera el saldo por {formatearMoneda(monto - Math.max(0, saldo))}. Puedes registrarlo igual
            (por ejemplo, un anticipo de otro trabajo).
          </p>
        )}

        {resultado && (
          <p
            role={resultado.tipo === "error" ? "alert" : "status"}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              resultado.tipo === "error"
                ? "bg-brick-50 text-brick-700"
                : resultado.tipo === "cola"
                  ? "bg-ochre-50 text-ochre-800"
                  : "bg-sage-50 text-sage-800"
            }`}
          >
            {resultado.tipo === "ok" && <CheckCircle2 className="size-4 shrink-0" aria-hidden />}
            {resultado.tipo === "cola" && <CloudUpload className="size-4 shrink-0" aria-hidden />}
            {resultado.texto}
          </p>
        )}

        <button
          type="button"
          onClick={guardar}
          disabled={monto <= 0 || pendiente}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent-600 text-base font-medium text-white active:bg-accent-700 disabled:bg-stone-200 disabled:text-stone-400"
        >
          {pendiente && <Loader2 className="size-5 animate-spin" aria-hidden />}
          {devolucion ? "Registrar devolución" : "Registrar abono"}
        </button>
      </div>

      {anulando && (
        <Drawer titulo="Anular pago" onClose={cerrarAnulacion}>
          <FormularioAnulacion
            advertencia="El pago NO se borra: queda anulado con su motivo y deja de contar en el saldo, la caja y el balance."
            onConfirmar={(motivo) => anularPago({ pagoId: anulando.id, ordenId, motivo })}
            onListo={cerrarAnulacion}
          />
        </Drawer>
      )}
    </div>
  );
}

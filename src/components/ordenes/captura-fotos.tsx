"use client";

import { useRef, useState } from "react";
import {
  Camera,
  FileText,
  MessageCircle,
  Snowflake,
  PackageCheck,
  PackageX,
  Thermometer,
  X,
  type LucideIcon,
} from "lucide-react";
import { useSync } from "@/components/sync/sync-provider";
import { PosMonto } from "@/components/ui/pos-monto";
import { pideCostoRepuesto, validarCostoRepuesto, type CostoRepuesto } from "@/lib/costo-repuesto";
import { nuevoId } from "@/lib/offline/operaciones";
import { comprimirImagen } from "@/lib/imagen";
import { formatearMoneda, TIPO_EVIDENCIA_LABEL } from "@/lib/ordenes";
import { enlaceWhatsApp, mensajeRepuestoInstalado } from "@/lib/whatsapp";
import type { TipoEvidencia } from "@/types/database";

// Botones neutros: el tipo de foto se distingue por icono y etiqueta, no por color.
const BOTONES: { tipo: TipoEvidencia; icono: LucideIcon }[] = [
  { tipo: "ingreso", icono: Camera },
  { tipo: "repuesto_viejo", icono: PackageX },
  { tipo: "repuesto_nuevo", icono: PackageCheck },
  { tipo: "prueba_tecnica", icono: Thermometer },
  { tipo: "factura_compra", icono: FileText },
];

type Mensaje = { tipo: "ok" | "error"; texto: string };

export type RepuestoFoto = {
  id: string;
  nombre: string;
  /** Costo de compra ya cargado en esa línea (cantidad × costo unitario). Si es 0, al fotografiarlo se pide. */
  costo: number;
};

/** Datos para sugerir el aviso por WhatsApp (sin teléfono no se ofrece). Nunca incluye costos. */
export type ClienteAviso = {
  nombre: string;
  telefono: string;
  /** "Chevrolet Spark GT 2018" */
  vehiculo: string;
  placa: string;
  urlPublica: string;
};

const ES_DE_REPUESTO: TipoEvidencia[] = ["repuesto_viejo", "repuesto_nuevo"];
const SIN_REPUESTO = "ninguno";

export function CapturaFotos({
  ordenId,
  repuestos,
  aviso = null,
}: {
  ordenId: string;
  repuestos: RepuestoFoto[];
  aviso?: ClienteAviso | null;
}) {
  const { registrar } = useSync();
  const inputRef = useRef<HTMLInputElement>(null);
  const tipoActivo = useRef<TipoEvidencia>("ingreso");
  const costoRef = useRef<CostoRepuesto | null>(null);
  const [subiendo, setSubiendo] = useState<TipoEvidencia | null>(null);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  // "" = aún no elige; SIN_REPUESTO = foto de algo que no está en la lista.
  const [repuestoId, setRepuestoId] = useState("");
  const elegido = repuestos.find((r) => r.id === repuestoId);

  // Panel que pide el costo y el precio antes de la foto del repuesto instalado.
  const [pidiendoCosto, setPidiendoCosto] = useState(false);
  const [nombreOtro, setNombreOtro] = useState("");
  const [digitosCosto, setDigitosCosto] = useState("");
  // null = no lo tocó: se cobra al costo. Una vez tocado, vacío significa 0.
  const [digitosPrecio, setDigitosPrecio] = useState<string | null>(null);
  const [sinCosto, setSinCosto] = useState(false);
  const [errorCosto, setErrorCosto] = useState<string | null>(null);

  // Sugerencia de WhatsApp tras subir la foto del repuesto instalado.
  const [sugerencia, setSugerencia] = useState<{ repuesto: string | null } | null>(null);

  const nombreRepuesto = elegido?.nombre ?? nombreOtro.trim();
  const costoNumero = Number(digitosCosto || "0");
  const precioNumero = digitosPrecio === null ? costoNumero : Number(digitosPrecio || "0");

  function abrirSelector(tipo: TipoEvidencia) {
    tipoActivo.current = tipo;
    inputRef.current?.click();
  }

  function abrirCamara(tipo: TipoEvidencia) {
    if (subiendo) return;
    if (ES_DE_REPUESTO.includes(tipo) && repuestos.length > 0 && repuestoId === "") {
      setMensaje({ tipo: "error", texto: "Primero elige de qué repuesto es la foto." });
      return;
    }
    setMensaje(null);
    setSugerencia(null);
    costoRef.current = null;

    // Repuesto instalado: si su costo aún no está registrado (no está en la lista o quedó en $0), se pide ahora.
    if (pideCostoRepuesto(tipo, elegido)) {
      setErrorCosto(null);
      setPidiendoCosto(true);
      return;
    }
    abrirSelector(tipo);
  }

  function confirmarCosto() {
    const r = validarCostoRepuesto({
      yaEnOrden: !!elegido,
      nombre: nombreRepuesto,
      costo: costoNumero,
      precio: digitosPrecio === null ? null : precioNumero,
      sinCosto,
    });
    if (!r.ok) {
      setErrorCosto(r.error);
      return;
    }
    setErrorCosto(null);
    costoRef.current = r.valor;
    setPidiendoCosto(false);
    abrirSelector("repuesto_nuevo");
  }

  function cancelarCosto() {
    setPidiendoCosto(false);
    setErrorCosto(null);
    costoRef.current = null;
  }

  function limpiarPanel() {
    setNombreOtro("");
    setDigitosCosto("");
    setDigitosPrecio(null);
    setSinCosto(false);
  }

  async function alSeleccionar(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir la misma foto
    if (!archivo) return;

    const tipo = tipoActivo.current;
    const costo = tipo === "repuesto_nuevo" ? costoRef.current : null;
    costoRef.current = null;
    setSubiendo(tipo);
    setMensaje(null);

    try {
      // Un repuesto comprado para el trabajo (no está en la orden) se AGREGA a la orden con su costo y su
      // precio: el costo baja el margen y el precio se suma a lo que se le cobra al cliente, sin que Polo
      // tenga que tocar el total. Va primero: la foto queda ligada a esa línea.
      let lineaNuevaId: string | null = null;
      if (costo && costo.costo > 0) {
        const id = nuevoId();
        const g = await registrar(
          {
            tipo: "repuesto.externo",
            datos: { id, orden_id: ordenId, nombre: costo.nombre, costo: costo.costo, precio: costo.precio },
          },
          null
        );
        if (g.estado === "error") {
          setMensaje({ tipo: "error", texto: `No se pudo agregar el repuesto a la orden: ${g.error}` });
          return;
        }
        lineaNuevaId = id;
      }

      const { blob, extension } = await comprimirImagen(archivo);
      // Va por la cola de sincronización: sin red se guarda en el teléfono y sube después (en orden).
      const r = await registrar(
        {
          tipo: "evidencia.subir",
          conArchivo: true,
          datos: {
            id: nuevoId(),
            orden_id: ordenId,
            tipo,
            extension,
            // Sin línea de repuesto (p. ej. «sin costo»), el nombre queda como leyenda de la foto.
            notas: costo && !lineaNuevaId && !elegido && costo.nombre ? costo.nombre : null,
            orden_repuesto_id: lineaNuevaId ?? (ES_DE_REPUESTO.includes(tipo) && elegido ? elegido.id : null),
          },
        },
        blob
      );
      if (r.estado === "error") {
        setMensaje({
          tipo: "error",
          texto: lineaNuevaId
            ? `El repuesto ya quedó en la orden, pero la foto no se pudo subir: ${r.error} Súbela eligiendo ese repuesto en la lista.`
            : r.error,
        });
        return;
      }

      const guardada =
        r.estado === "sincronizado"
          ? `${TIPO_EVIDENCIA_LABEL[tipo]}${elegido && ES_DE_REPUESTO.includes(tipo) ? ` · ${elegido.nombre}` : ""} guardada (${Math.round(blob.size / 1024)} KB).`
          : `${TIPO_EVIDENCIA_LABEL[tipo]} guardada en el teléfono; se subirá al volver la conexión.`;
      const agregado = lineaNuevaId
        ? ` «${costo!.nombre}» agregado a la orden: costo ${formatearMoneda(costo!.costo)}, se le cobra al cliente ${formatearMoneda(costo!.precio)}.`
        : "";

      setMensaje({ tipo: "ok", texto: guardada + agregado });
      if (tipo === "repuesto_nuevo") {
        if (aviso) setSugerencia({ repuesto: elegido?.nombre ?? (costo?.nombre || null) });
        limpiarPanel();
      }
    } catch (err) {
      setMensaje({
        tipo: "error",
        texto: err instanceof Error ? err.message : "No se pudo procesar la foto.",
      });
    } finally {
      setSubiendo(null);
    }
  }

  const hrefAviso =
    sugerencia && aviso
      ? enlaceWhatsApp(
          aviso.telefono,
          mensajeRepuestoInstalado({
            cliente: aviso.nombre,
            vehiculo: aviso.vehiculo,
            placa: aviso.placa,
            repuesto: sugerencia.repuesto,
            urlPublica: aviso.urlPublica,
          })
        )
      : null;

  return (
    <div className="space-y-3">
      {/* Un solo input nativo: abre directamente la cámara trasera del celular. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={alSeleccionar}
        className="hidden"
      />

      {repuestos.length > 0 && (
        <label className="block space-y-1.5">
          <span className="text-[13px] text-stone-500">Repuesto de las fotos «retirado» e «instalado»</span>
          <select
            value={repuestoId}
            onChange={(e) => setRepuestoId(e.target.value)}
            className="h-12 w-full rounded-xl border border-stone-300/70 bg-white px-3 text-[15px] outline-none focus:border-stone-400"
          >
            <option value="">— Elige el repuesto —</option>
            {repuestos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
            <option value={SIN_REPUESTO}>Otro (no está en la lista)</option>
          </select>
        </label>
      )}

      {pidiendoCosto && (
        <section aria-label="Costo del repuesto" className="space-y-3 rounded-2xl border border-stone-300 bg-stone-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold">Costo y cobro del repuesto</p>
              <p className="text-[13px] text-stone-600">
                {elegido ? `«${elegido.nombre}» no tiene costo cargado.` : "Este repuesto no está en la orden."} Se agrega
                a la orden: lo que pagaste baja el margen y lo que le cobras se suma al total del cliente. El cliente
                no ve el costo.
              </p>
            </div>
            <button
              type="button"
              onClick={cancelarCosto}
              aria-label="Cancelar"
              className="flex size-10 shrink-0 items-center justify-center rounded-full active:bg-stone-200"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          {!elegido && (
            <label className="block space-y-1">
              <span className="text-[13px] text-stone-600">¿Qué repuesto es?</span>
              <input
                value={nombreOtro}
                onChange={(e) => setNombreOtro(e.target.value)}
                maxLength={80}
                autoComplete="off"
                placeholder="Ej: Compresor, válvula de expansión…"
                className="h-12 w-full rounded-xl border border-stone-200/80 bg-white px-4 text-[15px] outline-none focus:border-stone-400"
              />
            </label>
          )}

          {!sinCosto && (
            <>
              <PosMonto id="costo-repuesto" etiqueta="¿Cuánto costó?" digitos={digitosCosto} onChange={setDigitosCosto} tamano="normal" />
              <PosMonto
                id="precio-repuesto"
                etiqueta="¿Cuánto se le cobra al cliente?"
                digitos={digitosPrecio ?? digitosCosto}
                onChange={setDigitosPrecio}
                tamano="normal"
              />
              <p className="text-[12px] text-stone-500">
                {precioNumero === 0 && digitosPrecio !== null
                  ? "Con $0 no se suma al total (úsalo si ya está incluido en lo que acordaste)."
                  : precioNumero > 0 && precioNumero < costoNumero
                    ? "Estás cobrando menos de lo que costó: Polo pierde la diferencia."
                    : "Por defecto se cobra al costo; súbelo si quieres ganarle."}
              </p>
            </>
          )}

          <label className="flex items-center gap-2 text-[13px] text-stone-600">
            <input
              type="checkbox"
              checked={sinCosto}
              onChange={(e) => setSinCosto(e.target.checked)}
              className="size-4 accent-ink"
            />
            Sin costo (el cliente trajo la pieza)
          </label>

          {errorCosto && (
            <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
              {errorCosto}
            </p>
          )}

          <button
            type="button"
            onClick={confirmarCosto}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink text-[15px] font-semibold text-white active:opacity-90"
          >
            <Camera className="size-5" aria-hidden />
            Continuar y tomar la foto
          </button>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        {BOTONES.map(({ tipo, icono: Icono }, i) => {
          const activo = subiendo === tipo;
          return (
            <button
              key={tipo}
              type="button"
              onClick={() => abrirCamara(tipo)}
              disabled={subiendo !== null}
              className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-stone-200/70 bg-white px-3 py-3 text-center text-sm font-medium text-ink shadow-soft transition-colors active:bg-stone-50 disabled:opacity-50 ${
                i === BOTONES.length - 1 ? "col-span-2 min-h-16 flex-row gap-3" : ""
              }`}
            >
              {activo ? (
                <Snowflake className="size-6 animate-copo text-stone-500" aria-hidden />
              ) : (
                <Icono className="size-6 text-stone-500" strokeWidth={1.5} aria-hidden />
              )}
              {activo ? "Subiendo…" : TIPO_EVIDENCIA_LABEL[tipo]}
            </button>
          );
        })}
      </div>

      {mensaje && (
        <p
          role={mensaje.tipo === "error" ? "alert" : "status"}
          className={`rounded-lg px-3 py-2 text-sm ${
            mensaje.tipo === "error"
              ? "bg-brick-50 text-brick-700"
              : "bg-sage-50 text-sage-800"
          }`}
        >
          {mensaje.texto}
        </p>
      )}

      {hrefAviso && (
        <div className="space-y-2 rounded-2xl border border-sage-300 bg-sage-50 p-3">
          <p className="text-[13px] text-sage-800">
            Puedes avisarle al cliente del cambio de la pieza: recibirá el enlace para ver el avance y la foto (sin costos).
          </p>
          <div className="flex gap-2">
            <a
              href={hrefAviso}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-sage-600 text-[15px] font-semibold text-white active:bg-sage-700"
            >
              <MessageCircle className="size-5" aria-hidden />
              Avisar por WhatsApp
            </a>
            <button
              type="button"
              onClick={() => setSugerencia(null)}
              className="h-12 rounded-xl border border-sage-300 bg-white px-4 text-[14px] font-medium text-sage-800 active:bg-sage-50"
            >
              Ahora no
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

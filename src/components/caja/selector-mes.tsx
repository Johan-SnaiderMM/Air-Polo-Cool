import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { etiquetaMes, mesActual, mesAnterior, mesSiguiente } from "@/lib/caja";

type Props = {
  mes: string; // YYYY-MM
  vista: VistaCaja;
  /** Parámetros extra a conservar al cambiar de mes (ej. anulados=1). */
  extra?: Record<string, string>;
};

export type VistaCaja = "gastos" | "caja" | "balance";

export function hrefCaja(vista: VistaCaja, mes: string, extra?: Record<string, string>) {
  const params = new URLSearchParams();
  if (vista !== "gastos") params.set("vista", vista);
  for (const [k, v] of Object.entries(extra ?? {})) params.set(k, v);
  if (mes !== mesActual()) params.set("mes", mes);
  const qs = params.toString();
  return qs ? `/caja-menor?${qs}` : "/caja-menor";
}

export function SelectorMes({ mes, vista, extra }: Props) {
  const esActual = mes >= mesActual();

  const flecha =
    "flex size-12 items-center justify-center rounded-full border border-stone-300/70 bg-white active:bg-stone-100";

  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        href={hrefCaja(vista, mesAnterior(mes), extra)}
        replace
        aria-label="Mes anterior"
        className={flecha}
      >
        <ChevronLeft className="size-6" aria-hidden />
      </Link>

      <p className="flex-1 text-center font-serif text-xl font-medium tracking-tight">{etiquetaMes(mes)}</p>

      {esActual ? (
        <span aria-hidden className={`${flecha} opacity-30`}>
          <ChevronRight className="size-6" />
        </span>
      ) : (
        <Link
          href={hrefCaja(vista, mesSiguiente(mes), extra)}
          replace
          aria-label="Mes siguiente"
          className={flecha}
        >
          <ChevronRight className="size-6" aria-hidden />
        </Link>
      )}
    </div>
  );
}

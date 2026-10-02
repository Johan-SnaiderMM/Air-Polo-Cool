"use client";

const MAX_DIGITOS = 10; // numeric(12,2): hasta 9 999 999 999
const miles = new Intl.NumberFormat("es-CO");

/** Solo dígitos, sin ceros a la izquierda, con tope de longitud. */
export function limpiarDigitos(texto: string): string {
  return texto.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_DIGITOS);
}

type Props = {
  id: string;
  etiqueta: string;
  /** Solo dígitos: el formato con separador de miles se aplica al mostrar. */
  digitos: string;
  onChange: (digitos: string) => void;
  /** "grande" para el registro principal; "normal" para formularios secundarios. */
  tamano?: "grande" | "normal";
  autoFocus?: boolean;
};

/**
 * Monto estilo terminal/POS: símbolo integrado, cifras tabulares grandes y teclado
 * numérico nativo. Se usa `inputMode="numeric"` (no "decimal"): el peso colombiano no
 * lleva centavos y así el teclado no muestra una tecla de coma que no haría nada.
 */
export function PosMonto({ id, etiqueta, digitos, onChange, tamano = "grande", autoFocus }: Props) {
  const grande = tamano === "grande";
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase"
      >
        {etiqueta}
      </label>
      <div className="flex items-baseline gap-3 rounded-xl border border-stone-200/80 bg-stone-50/70 px-4 py-3 transition-colors focus-within:border-stone-400 focus-within:bg-white">
        <span className={`font-mono text-stone-400 ${grande ? "text-2xl" : "text-xl"}`} aria-hidden>
          $
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="0"
          value={digitos ? miles.format(Number(digitos)) : ""}
          onChange={(e) => onChange(limpiarDigitos(e.target.value))}
          className={`w-full min-w-0 bg-transparent text-right font-mono leading-none tracking-tight tabular-nums outline-none placeholder:text-stone-400 ${
            grande ? "text-4xl" : "text-3xl"
          }`}
        />
      </div>
    </div>
  );
}

import Link from "next/link";

/** Pie discreto con los dos documentos legales (login, portal del cliente e inicio). */
export function EnlacesLegales({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-[12px] text-stone-500 print:hidden ${className}`}>
      <Link href="/legal/privacidad" className="underline underline-offset-2">
        Política de privacidad
      </Link>
      <span aria-hidden> · </span>
      <Link href="/legal/aviso" className="underline underline-offset-2">
        Aviso legal
      </Link>
    </p>
  );
}

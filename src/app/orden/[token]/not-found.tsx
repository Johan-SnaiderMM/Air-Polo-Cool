import type { Metadata } from "next";
import Image from "next/image";
import { LinkIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Enlace no válido",
  robots: { index: false, follow: false },
};

export default function OrdenNoEncontrada() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <Image src="/logo.png" alt="" width={80} height={80} priority className="size-20 rounded-full" />
      <h1 className="font-serif text-2xl font-medium tracking-tight">Polo Air Cool</h1>
      <p className="flex items-center gap-2 text-lg font-semibold">
        <LinkIcon className="size-5" aria-hidden /> Enlace no válido
      </p>
      <p className="text-sm text-stone-600">
        No encontramos ningún servicio con este enlace. Revisa que esté completo o
        solicita uno nuevo al taller.
      </p>
    </main>
  );
}

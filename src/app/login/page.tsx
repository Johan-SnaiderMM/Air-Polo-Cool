import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Image src="/logo.png" alt="" width={120} height={120} priority className="size-28 rounded-full shadow-soft" />
        <h1 className="font-serif text-[36px] leading-tight font-medium tracking-tight">Polo Air Cool</h1>
        <p className="text-[13px] text-stone-500">Acceso del taller</p>
      </div>
      <LoginForm next={next ?? "/"} />
    </main>
  );
}

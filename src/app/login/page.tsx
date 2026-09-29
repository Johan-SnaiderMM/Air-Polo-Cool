import type { Metadata } from "next";
import { Snowflake } from "lucide-react";
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
        <Snowflake className="size-7 text-accent-600" strokeWidth={1.5} aria-hidden />
        <h1 className="font-serif text-[36px] leading-tight font-medium tracking-tight">Polo Air Cool</h1>
        <p className="text-[13px] text-stone-500">Acceso del taller</p>
      </div>
      <LoginForm next={next ?? "/"} />
    </main>
  );
}

import { UserX } from "lucide-react";
import { cerrarSesion } from "@/app/login/actions";

/**
 * Lo que ve alguien a quien el dueño desactivó mientras todavía tenía la sesión abierta. La base ya le
 * niega los datos; esto evita que la app se vea rota y le explica qué pasó.
 */
export function PantallaAccesoDesactivado() {
  return (
    <div className="mx-auto mt-16 max-w-sm space-y-5 text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-brick-100 text-brick-700">
        <UserX className="size-7" aria-hidden />
      </span>
      <div className="space-y-2">
        <h1 className="font-serif text-2xl font-medium tracking-tight">Tu acceso está desactivado</h1>
        <p className="text-[15px] text-stone-600">Habla con el dueño del taller si crees que es un error.</p>
      </div>
      <form action={cerrarSesion}>
        <button
          type="submit"
          className="mx-auto flex h-12 items-center justify-center rounded-xl bg-ink px-6 text-[15px] font-semibold text-white active:opacity-90"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}

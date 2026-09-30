"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CarFront,
  House,
  Package,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/ordenes", label: "Órdenes", icon: Wrench },
  { href: "/vehiculos", label: "Vehículos", icon: CarFront },
  { href: "/inventario", label: "Inventario", icon: Package },
  { href: "/caja-menor", label: "Caja", icon: Wallet },
];

function estaActivo(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // /garantias cuelga conceptualmente de Vehículos.
  if (href === "/vehiculos" && pathname.startsWith("/garantias")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Barra inferior anclada, translúcida (blur) con borde milimétrico.
 * El estado activo se marca solo con tinta (icono + etiqueta) y un trazo superior fino;
 * los inactivos quedan en gris cálido. Sin color de acento.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200/70 bg-stone-50/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-md print:hidden"
    >
      <ul className="mx-auto grid h-16 w-full max-w-2xl grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = estaActivo(pathname, href);
          return (
            <li key={href} className="relative">
              {active && (
                <span
                  className="absolute inset-x-0 top-0 mx-auto h-0.5 w-6 rounded-full bg-ink"
                  aria-hidden
                />
              )}
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full min-h-14 flex-col items-center justify-center gap-1 text-[11px] tracking-wide transition-colors ${
                  active ? "font-semibold text-ink" : "font-medium text-stone-400"
                }`}
              >
                <Icon
                  className="size-[22px]"
                  strokeWidth={active ? 2.25 : 1.75}
                  aria-hidden="true"
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

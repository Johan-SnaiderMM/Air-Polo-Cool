import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { RegistrarServiceWorker } from "@/components/sync/registrar-sw";
import { SCRIPT_TEMA } from "@/lib/tema";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Serif editorial solo para títulos y cifras destacadas.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Polo Air Cool",
    template: "%s · Polo Air Cool",
  },
  description:
    "Gestión de órdenes, inventario y caja menor del taller de aire acondicionado automotriz Polo Air Cool.",
  applicationName: "Polo Air Cool",
  // Aplicación privada: ninguna página debe salir en buscadores (el robots.txt también lo bloquea).
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: false },
  appleWebApp: {
    capable: true,
    title: "Polo Air Cool",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  // Barra del navegador / estado del teléfono: sigue al sistema desde el primer momento; al elegir un tema a mano,
  // el botón del encabezado la ajusta (src/components/layout/boton-tema.tsx).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: el script de <head> pone data-tema en <html> antes de que React hidrate.
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="flex min-h-full flex-col bg-paper text-ink">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}

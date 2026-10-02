import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Polo Air Cool",
    short_name: "Polo Air Cool",
    description: "Gestión del taller de aire acondicionado automotriz.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "es",
    // La pantalla de carga de Android pinta el logo (icono «maskable», fondo azul marino) sobre este color. Debe ser
    // EL MISMO azul marino del icono: así el marco del icono no se ve y queda solo el logo. El manifiesto no puede
    // cambiar con el tema (claro/oscuro), así que se elige un color que se ve bien en ambos.
    background_color: "#0b1633",
    theme_color: "#f4f7fb",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

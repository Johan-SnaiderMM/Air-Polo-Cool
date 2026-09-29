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
    background_color: "#f4f7fb",
    theme_color: "#f4f7fb",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

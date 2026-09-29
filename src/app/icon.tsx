import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Ícono generado (PNG 512x512). El contenido queda dentro de la zona segura "maskable".
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1f1e1d",
          color: "#f7f6f2",
          fontSize: 240,
          fontWeight: 800,
          letterSpacing: -8,
        }}
      >
        PAC
      </div>
    ),
    size
  );
}

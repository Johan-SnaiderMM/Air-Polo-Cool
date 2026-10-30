import type { MetadataRoute } from "next";

/**
 * Esta es una aplicación privada: no debe aparecer en buscadores. Se bloquea todo el sitio (el portal del
 * cliente, además, lleva «noindex» en su propia página) y las páginas legales se consultan por enlace.
 * Si algún día hay una página pública del taller, aquí se permite solo esa ruta.
 *
 * Única excepción: LinkedInBot, que solo lee la tarjeta de vista previa (nombre, descripción e imagen) cuando
 * alguien pega el enlace en LinkedIn. No es un buscador y todo lo demás sigue pidiendo inicio de sesión.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "LinkedInBot", allow: "/" },
      { userAgent: "*", disallow: "/" },
    ],
  };
}

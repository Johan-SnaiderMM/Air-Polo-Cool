/*
 * Service worker de Polo Air Cool — soporte offline de LECTURA y del "cascarón" de la app.
 *
 * Qué hace:
 *  - Estáticos (/_next/static, íconos, logo): cache-first con actualización en segundo plano.
 *  - Páginas y datos RSC de la app: network-first (4 s) y, si no hay red, la ÚLTIMA versión
 *    vista (así se pueden consultar órdenes, vehículos, inventario y caja ya visitados).
 *  - Sin red y sin copia: /offline.html.
 *
 * Qué NO hace (a propósito):
 *  - No toca POST (las Server Actions y la cola de sincronización van por la app, no por aquí).
 *  - No guarda el portal público /orden/*, la exportación CSV ni peticiones de precarga.
 *  - No sustituye a IndexedDB: los registros nuevos hechos sin conexión viven en la cola local
 *    de la app (ver src/lib/offline/almacen.ts).
 *
 * Avisos (notificaciones push): recibe el resumen de la agenda que manda el servidor y lo muestra aunque
 * la app esté cerrada; al tocarlo abre (o enfoca) la app en la pantalla indicada.
 *
 * Al cerrar sesión, la app borra todas estas cachés (contienen datos del taller).
 */
const VERSION = "v1";
const CACHE_ESTATICO = `pac-estatico-${VERSION}`;
// Documentos HTML y payloads RSC (navegación interna de Next) van en cachés SEPARADAS:
// así una petición RSC nunca recibe un HTML guardado ni al revés.
const CACHE_PAGINAS = `pac-paginas-${VERSION}`;
const CACHE_RSC = `pac-rsc-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const MAX_PAGINAS = 80;
const TIMEOUT_RED_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_ESTATICO)
      .then((cache) => cache.addAll([OFFLINE_URL, "/logo.png", "/icons/icon-192.png", "/icons/badge-96.png"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const clave of await caches.keys()) {
        if (!clave.endsWith(VERSION)) await caches.delete(clave);
      }
      await self.clients.claim();
    })()
  );
});

/** Recorta la caché de páginas a las más recientes (FIFO por orden de inserción). */
async function recortar(cache) {
  const claves = await cache.keys();
  for (let i = 0; i < claves.length - MAX_PAGINAS; i++) await cache.delete(claves[i]);
}

function conTimeout(promesa, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promesa.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function estatico(request) {
  const cache = await caches.open(CACHE_ESTATICO);
  const guardado = await cache.match(request);
  const actualizar = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return guardado || (await actualizar) || Response.error();
}

async function paginas(request, esRsc) {
  const cache = await caches.open(esRsc ? CACHE_RSC : CACHE_PAGINAS);
  try {
    const res = await conTimeout(fetch(request), TIMEOUT_RED_MS);
    // Solo respuestas reales de la página: nada de redirecciones al login ni errores.
    if (res.ok && !res.redirected && res.type === "basic") {
      cache.put(request, res.clone()).then(() => recortar(cache));
    }
    return res;
  } catch {
    // RSC: la URL trae un parámetro _rsc variable y cabeceras Vary que cambian con el estado del
    // router; se ignoran para poder servir la última copia de esa ruta.
    const copia = await cache.match(request, esRsc ? { ignoreSearch: true, ignoreVary: true } : undefined);
    if (copia) return copia;
    if (request.mode === "navigate") {
      const offline = await caches.match(OFFLINE_URL);
      if (offline) return offline;
    }
    return new Response("Sin conexión", { status: 503, statusText: "Sin conexión" });
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const ruta = url.pathname;
  if (ruta === "/sw.js" || ruta.startsWith("/orden/") || ruta.startsWith("/caja-menor/exportar")) return;

  if (
    ruta.startsWith("/_next/static/") ||
    ruta.startsWith("/icons/") ||
    /\.(?:png|jpe?g|webp|svg|ico|woff2?)$/.test(ruta)
  ) {
    event.respondWith(estatico(request));
    return;
  }

  // Precargas de enlaces: se dejan pasar (podrían ser payloads parciales).
  if (request.headers.get("Next-Router-Prefetch") || request.headers.get("Purpose") === "prefetch") return;

  const esRsc = request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  if (request.mode === "navigate" || esRsc) {
    event.respondWith(paginas(request, esRsc));
  }
});

// ---------------------------------------------------------------------
// Avisos (push): resumen de la agenda
// ---------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = {};
  }
  // Siempre se muestra algo: el navegador exige que cada aviso recibido se vea (userVisibleOnly).
  event.waitUntil(
    self.registration.showNotification(typeof datos.titulo === "string" && datos.titulo ? datos.titulo : "Polo Air Cool", {
      body: typeof datos.cuerpo === "string" ? datos.cuerpo : "",
      icon: "/icons/icon-192.png",
      // Icono pequeño de la barra de estado: Android lo pinta como silueta, así que es un copo blanco sobre transparente.
      badge: "/icons/badge-96.png",
      // Mismo tag = el aviso nuevo reemplaza al anterior en vez de apilarse.
      tag: typeof datos.etiqueta === "string" && datos.etiqueta ? datos.etiqueta : "polo-aviso",
      data: { url: typeof datos.url === "string" ? datos.url : "/agenda" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const pedida = event.notification.data && event.notification.data.url;
  let destino;
  try {
    destino = new URL(typeof pedida === "string" ? pedida : "/agenda", self.location.origin);
  } catch {
    destino = new URL("/agenda", self.location.origin);
  }
  // Solo pantallas de la propia app: un aviso nunca abre otro sitio.
  if (destino.origin !== self.location.origin) destino = new URL("/agenda", self.location.origin);

  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const ventana of ventanas) {
        if (!("focus" in ventana)) continue;
        await ventana.focus();
        if ("navigate" in ventana) await ventana.navigate(destino.href).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(destino.href);
    })()
  );
});

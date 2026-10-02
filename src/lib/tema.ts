/**
 * Tema claro / oscuro (módulo puro). La elección vive en `localStorage` (por teléfono); si el usuario
 * nunca la hizo, se sigue la preferencia del sistema. El tema se aplica con un atributo en <html>
 * (`data-tema="dark"`) ANTES de pintar la página, para que no haya un destello claro al abrir.
 *
 * El portal público del cliente (/orden/…) siempre se ve claro: es un documento de la marca para
 * quien no tiene la app, y no debe cambiar según el teléfono de cada cliente.
 */
export const CLAVE_TEMA = "polo:tema";

export type PreferenciaTema = "claro" | "oscuro";

/** Color de la barra del navegador / estado del teléfono en cada tema (coincide con --color-paper). */
export const COLOR_BARRA: Record<PreferenciaTema, string> = { claro: "#f4f7fb", oscuro: "#0b1220" };

/** ¿Hay que pintar oscuro? La elección guardada manda; sin elección, el sistema. */
export function esOscuro(guardada: string | null, sistemaOscuro: boolean): boolean {
  if (guardada === "oscuro") return true;
  if (guardada === "claro") return false;
  return sistemaOscuro;
}

/**
 * Script que corre en <head> antes del primer pintado. Es una copia en texto de `esOscuro` (no puede
 * importar nada); `tema.test.ts` comprueba que se comportan igual.
 */
export const SCRIPT_TEMA = `(function(){try{var g=null;try{g=localStorage.getItem("${CLAVE_TEMA}")}catch(e){}var s=!!(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);var o=g==="oscuro"||(g!=="claro"&&s);if(o&&location.pathname.indexOf("/orden/")!==0){document.documentElement.setAttribute("data-tema","dark")}}catch(e){}})();`;

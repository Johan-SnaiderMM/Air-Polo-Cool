/** Buckets privados de Supabase Storage y vigencia de las URLs firmadas que se entregan. */
export const BUCKET_EVIDENCIAS = "evidencias-ordenes";
export const BUCKET_FACTURAS = "facturas-gastos";

/** Pantallas internas: la URL firmada dura una hora. */
export const VIGENCIA_URL_INTERNA_SEGUNDOS = 60 * 60;
/** Portal público del cliente: dos horas, para que pueda abrir y ampliar las fotos con calma. */
export const VIGENCIA_URL_PORTAL_SEGUNDOS = 2 * 60 * 60;

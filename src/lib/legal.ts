/**
 * Textos legales (módulo puro): política de tratamiento de datos personales (Ley 1581 de 2012) y aviso
 * legal. Son un BORRADOR DE PARTIDA redactado según cómo funciona la app hoy; antes de publicarlos como
 * definitivos conviene que los revise una persona con criterio legal (ver README «Legal»).
 *
 * Los datos de identificación del responsable salen de `RESPONSABLE`: lo que no esté completo se omite
 * en el texto en vez de mostrar un hueco.
 */
import { TALLER } from "@/lib/taller";

/** Datos del responsable del tratamiento. Completa los que falten (todos son opcionales). */
export const RESPONSABLE = {
  /** Razón social o nombre del propietario, tal como aparece en el RUT. */
  razonSocial: null as string | null,
  nit: null as string | null,
  direccion: null as string | null,
  /** Correo para consultas y reclamos de datos personales. */
  correo: null as string | null,
};

/** Última revisión de los textos (se muestra en las páginas). */
export const ACTUALIZADO_LEGAL = "2 de octubre de 2026";

export type SeccionLegal = { id: string; titulo: string; parrafos: string[]; lista?: string[] };
export type DocumentoLegal = { titulo: string; descripcion: string; introduccion: string; secciones: SeccionLegal[] };

/** «Polo Air Cool (razón social, NIT …)» con lo que se tenga. */
export function identificacionResponsable(r: typeof RESPONSABLE = RESPONSABLE): string {
  const partes = [r.razonSocial, r.nit ? `NIT ${r.nit}` : null, r.direccion].filter(Boolean);
  return partes.length > 0 ? `${TALLER.nombre} (${partes.join(", ")})` : TALLER.nombre;
}

/** Cómo contactar al responsable: siempre el teléfono / WhatsApp del taller, y el correo si existe. */
export function canalesContacto(r: typeof RESPONSABLE = RESPONSABLE): string {
  const canales = [`teléfono o WhatsApp ${TALLER.telefonoVisible}`];
  if (r.correo) canales.push(`correo ${r.correo}`);
  return canales.join(" o ");
}

export function politicaPrivacidad(r: typeof RESPONSABLE = RESPONSABLE): DocumentoLegal {
  const contacto = canalesContacto(r);
  return {
    titulo: "Política de privacidad",
    descripcion: "Cómo Polo Air Cool trata los datos personales de sus clientes y de su equipo (Ley 1581 de 2012).",
    introduccion:
      "Esta política explica qué datos personales trata Polo Air Cool, para qué, con quién los comparte y cómo puedes ejercer tus derechos, conforme a la Ley 1581 de 2012, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y el artículo 15 de la Constitución sobre habeas data.",
    secciones: [
      {
        id: "responsable",
        titulo: "1. Quién es el responsable",
        parrafos: [
          `El responsable del tratamiento es ${identificacionResponsable(r)}, taller de ${TALLER.subtitulo.toLowerCase()}.`,
          `Puedes contactarnos por ${contacto}.`,
          "La plataforma en la que se registra el trabajo del taller es una herramienta de gestión; los datos de los clientes pertenecen al taller y se usan solo para atenderlos.",
        ],
      },
      {
        id: "datos",
        titulo: "2. Qué datos tratamos",
        parrafos: ["Según tu relación con el taller, podemos tratar:"],
        lista: [
          "Clientes: nombre, número de WhatsApp o teléfono y, si lo aportas, documento de identidad.",
          "Vehículo: placa, marca, línea, año, kilometraje, tipo de refrigerante y fotos del vehículo y de los repuestos retirados e instalados.",
          "Servicio: diagnóstico, trabajos realizados, repuestos, citas y mantenimientos programados, garantía y notas del taller.",
          "Pagos: valores, medio de pago (efectivo, transferencia, tarjeta u otro), referencia y comprobantes de lo que pagas o se te devuelve.",
          "Equipo del taller: correo de acceso, rol y registro de quién hizo cada acción y cuándo. Las contraseñas las gestiona el proveedor de autenticación y no las vemos.",
          "Datos técnicos del dispositivo, solo si activas los avisos: la suscripción de tu teléfono a las notificaciones.",
        ],
      },
      {
        id: "sensibles",
        titulo: "3. Datos sensibles y menores",
        parrafos: [
          "No recolectamos de forma intencional datos sensibles (salud, origen, orientación, biometría, etc.) ni datos de menores de edad. Si por error se registrara alguno, puedes pedir su supresión.",
        ],
      },
      {
        id: "finalidades",
        titulo: "4. Para qué los usamos",
        parrafos: ["Tratamos tus datos únicamente para:"],
        lista: [
          "Recibir tu vehículo, registrar el diagnóstico y el trabajo, y llevar su historial por placa.",
          "Informarte del avance del servicio, incluido el enlace de seguimiento con fotos, repuestos, saldo y garantía.",
          "Contactarte por WhatsApp para confirmar o recordarte una cita, avisarte que tu vehículo está listo, recordarte una garantía por vencer o un mantenimiento preventivo, y recordarte un saldo pendiente.",
          "Llevar los cobros, abonos, devoluciones y la contabilidad del taller.",
          "Cumplir obligaciones legales, contables y de garantía, y atender tus consultas y reclamos.",
        ],
      },
      {
        id: "autorizacion",
        titulo: "5. Tu autorización",
        parrafos: [
          "Tratamos tus datos con tu autorización previa, expresa e informada, que puedes dar de forma verbal, escrita o con una conducta inequívoca, por ejemplo al dejar tu vehículo y suministrar tus datos para el servicio. Puedes revocarla en cualquier momento, salvo que exista un deber legal o contractual de conservar los datos.",
        ],
      },
      {
        id: "terceros",
        titulo: "6. Con quién los compartimos",
        parrafos: [
          "No vendemos tus datos. Los compartimos solo con quienes hacen posible el servicio, como encargados del tratamiento:",
        ],
        lista: [
          "Proveedor de base de datos, autenticación y almacenamiento de archivos (fotos y comprobantes): Supabase.",
          "Proveedor de alojamiento de la aplicación: Vercel.",
          "WhatsApp (Meta): cuando el taller te escribe, el mensaje sale desde su propia cuenta de WhatsApp y se rige por las condiciones de esa plataforma.",
        ],
      },
      {
        id: "internacional",
        titulo: "7. Servidores fuera de Colombia",
        parrafos: [
          "Esos proveedores pueden almacenar o procesar datos en servidores ubicados fuera de Colombia. Los usamos bajo sus condiciones de seguridad y confidencialidad para prestar el servicio, y no los usamos para otros fines.",
        ],
      },
      {
        id: "enlace",
        titulo: "8. El enlace de seguimiento de tu vehículo",
        parrafos: [
          "Te compartimos un enlace único y no listado para que veas el estado de tu servicio. Muestra tu nombre, los datos del vehículo, el avance, las fotos, los repuestos cambiados, el saldo y la garantía; no muestra tu teléfono, tu documento, los costos de compra del taller ni sus notas internas. Cualquier persona que tenga el enlace puede verlo, así que compártelo solo con quien quieras. Los buscadores no lo indexan.",
        ],
      },
      {
        id: "seguridad",
        titulo: "9. Cómo los protegemos",
        parrafos: [
          "El acceso al sistema exige usuario y contraseña, cada persona del equipo tiene los permisos que necesita, la comunicación va cifrada (HTTPS), los archivos están en almacenamiento privado y cada cambio importante queda registrado con quién y cuándo. Ningún sistema es infalible; si detectamos un incidente que afecte tus datos, actuaremos y te informaremos según la ley.",
        ],
      },
      {
        id: "conservacion",
        titulo: "10. Cuánto tiempo los conservamos",
        parrafos: [
          "Conservamos tus datos mientras sean necesarios para el servicio, la garantía y el historial de tu vehículo, y durante los plazos que exijan las normas contables, tributarias y de protección al consumidor. Los registros de dinero no se borran: se anulan con motivo para conservar la trazabilidad.",
        ],
      },
      {
        id: "derechos",
        titulo: "11. Tus derechos",
        parrafos: ["Como titular de los datos puedes:"],
        lista: [
          "Conocer, actualizar y rectificar tus datos.",
          "Pedir prueba de la autorización que diste.",
          "Ser informado del uso que se ha dado a tus datos.",
          "Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la ley.",
          "Revocar la autorización y/o solicitar la supresión de tus datos cuando no exista un deber legal de conservarlos.",
          "Acceder de forma gratuita a tus datos.",
        ],
      },
      {
        id: "canal",
        titulo: "12. Cómo ejercerlos",
        parrafos: [
          `Escríbenos o llámanos por ${contacto}, indicando tu nombre, cómo contactarte y qué solicitas. Responderemos las consultas en máximo 10 días hábiles (prorrogables 5 más, con aviso) y los reclamos en máximo 15 días hábiles (prorrogables 8 más, con aviso), como indica la ley.`,
        ],
      },
      {
        id: "cookies",
        titulo: "13. Cookies y almacenamiento en tu dispositivo",
        parrafos: [
          "La aplicación usa solo lo necesario para funcionar: una cookie de sesión para mantenerte dentro del sistema y almacenamiento local para guardar tu preferencia de tema (claro u oscuro), los registros que hagas sin conexión hasta que se sincronicen y copias de pantallas ya vistas. No usamos cookies de publicidad ni de seguimiento de terceros. Las notificaciones solo se activan si tú lo decides.",
        ],
      },
      {
        id: "cambios",
        titulo: "14. Cambios a esta política",
        parrafos: [
          `Podemos actualizar esta política; la versión vigente es la publicada aquí, con la fecha de su última revisión (${ACTUALIZADO_LEGAL}). Si el cambio es sustancial, te lo informaremos por los medios habituales.`,
        ],
      },
    ],
  };
}

export function avisoLegal(r: typeof RESPONSABLE = RESPONSABLE): DocumentoLegal {
  const contacto = canalesContacto(r);
  return {
    titulo: "Aviso legal",
    descripcion: "Condiciones de uso de la plataforma de gestión y del enlace de seguimiento de Polo Air Cool.",
    introduccion: "Estas condiciones regulan el uso de la plataforma de gestión de Polo Air Cool y del enlace de seguimiento que se comparte con los clientes.",
    secciones: [
      {
        id: "titular",
        titulo: "1. Titular",
        parrafos: [`${identificacionResponsable(r)}. Contacto: ${contacto}.`],
      },
      {
        id: "objeto",
        titulo: "2. Qué es esta plataforma",
        parrafos: [
          "Es una herramienta para que el taller gestione sus clientes, vehículos, órdenes de servicio, citas, inventario, cobros y garantías. Una parte limitada, el enlace de seguimiento, se comparte con cada cliente para que consulte el avance de su servicio.",
        ],
      },
      {
        id: "acceso",
        titulo: "3. Acceso y uso",
        parrafos: [
          "El acceso al sistema es solo para el equipo autorizado del taller, con su usuario y contraseña personales, que no deben compartirse. El enlace de seguimiento es para el cliente del vehículo correspondiente; está prohibido intentar acceder a información de otros clientes o a zonas restringidas, o alterar el funcionamiento de la plataforma.",
        ],
      },
      {
        id: "propiedad",
        titulo: "4. Propiedad intelectual",
        parrafos: [
          "La marca, el logotipo y los contenidos del taller son de su titular. El software de la plataforma y su diseño pertenecen a su desarrollador y se ponen a disposición del taller para su uso. No se permite copiarlos ni distribuirlos sin autorización.",
        ],
      },
      {
        id: "informacion",
        titulo: "5. Carácter informativo",
        parrafos: [
          "La información del enlace de seguimiento (estado, fotos, repuestos, saldo y fecha de garantía) es informativa. Los términos de la garantía y del pago son los acordados con el taller al recibir el vehículo. Ante cualquier diferencia, prima lo acordado con el taller; escríbenos para aclararla.",
        ],
      },
      {
        id: "disponibilidad",
        titulo: "6. Disponibilidad",
        parrafos: [
          "Hacemos nuestro mejor esfuerzo para que la plataforma esté disponible, pero puede interrumpirse por mantenimiento o por causas ajenas (conexión, proveedores). No respondemos por perjuicios derivados de interrupciones razonables.",
        ],
      },
      {
        id: "enlaces",
        titulo: "7. Enlaces y servicios de terceros",
        parrafos: [
          "La plataforma puede abrir servicios de terceros, como WhatsApp. Su uso se rige por las condiciones de cada uno y el taller no es responsable de ellos.",
        ],
      },
      {
        id: "datos",
        titulo: "8. Datos personales",
        parrafos: ["El tratamiento de datos personales se rige por nuestra Política de privacidad."],
      },
      {
        id: "ley",
        titulo: "9. Ley aplicable",
        parrafos: [
          "Estas condiciones se rigen por las leyes de la República de Colombia. Las diferencias se buscarán resolver primero de manera directa y, si no es posible, ante la autoridad competente.",
        ],
      },
    ],
  };
}

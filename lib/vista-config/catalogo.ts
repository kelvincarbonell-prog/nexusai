/**
 * Catálogo de módulos que el gestor puede activar/desactivar para sus
 * dos vistas configurables: «asesor» (compañeros del despacho) y
 * «cliente» (portal del autónomo/empresa).
 *
 * Cada módulo se mapea a una o varias rutas de la app. Si está
 * desactivado, las pestañas/links se ocultan en el sidebar y, en server,
 * la página devuelve 404.
 */

export type Alcance = "asesor" | "cliente";

export type ModuloDef = {
  key: string;
  label: string;
  descripcion: string;
  /** Rutas (prefijos) que controla este módulo. */
  rutas: string[];
  /** Si está activado por defecto. */
  default: boolean;
};

/** Módulos visibles para los asesores del equipo (vista interna). */
export const MODULOS_ASESOR: ModuloDef[] = [
  { key: "dashboard", label: "Dashboard", descripcion: "Panel inicial con bandeja, KPIs y alertas.", rutas: ["/"], default: true },
  { key: "clientes", label: "Clientes", descripcion: "Cartera de empresas y autónomos asignados.", rutas: ["/clientes"], default: true },
  { key: "laboral", label: "Laboral / Nóminas", descripcion: "Trabajadores, nóminas, cuadrante, fichajes, finiquitos.", rutas: ["/laboral"], default: true },
  { key: "fiscal", label: "Fiscal / AEAT", descripcion: "Modelos 303, 130, 390, 200, 111, 347, 349, etc.", rutas: ["/declaraciones", "/aeat"], default: true },
  { key: "contabilidad", label: "Contabilidad", descripcion: "Diario, mayor, balances, cierre y apertura.", rutas: ["/contabilidad"], default: true },
  { key: "bancos", label: "Bancos", descripcion: "Conciliación bancaria PSD2, importación y categorización.", rutas: ["/bancos"], default: true },
  { key: "facturas", label: "Facturas y OCR", descripcion: "Emitidas, recibidas, buzón único y captura OCR.", rutas: ["/facturas", "/buzon"], default: true },
  { key: "inmovilizado", label: "Inmovilizado", descripcion: "Activos fijos, amortizaciones y bajas.", rutas: ["/inmovilizado"], default: false },
  { key: "prl", label: "PRL", descripcion: "Reconocimientos, formaciones, EPIs, vigilancia salud.", rutas: ["/prl"], default: false },
  { key: "documentos", label: "Documentos", descripcion: "Repositorio de documentación del cliente.", rutas: ["/documentos"], default: true },
  { key: "recordatorios", label: "Recordatorios", descripcion: "Avisos automáticos y manuales.", rutas: ["/recordatorios"], default: true },
  { key: "agentes", label: "Agentes IA", descripcion: "Cobros, triaje de solicitudes, OCR, conciliación.", rutas: ["/agentes"], default: true },
];

/** Módulos visibles para clientes en el portal. */
export const MODULOS_CLIENTE: ModuloDef[] = [
  { key: "inicio", label: "Inicio", descripcion: "Resumen de su negocio.", rutas: ["/cliente"], default: true },
  { key: "facturas_emit", label: "Facturas emitidas", descripcion: "Su facturación a clientes propios.", rutas: ["/cliente/facturas"], default: true },
  { key: "facturas_recv", label: "Facturas recibidas", descripcion: "Gastos y facturas de proveedores.", rutas: ["/cliente/gastos"], default: true },
  { key: "buzon", label: "Buzón documental", descripcion: "Sube fotos / PDFs y el agente los archiva.", rutas: ["/cliente/buzon"], default: true },
  { key: "nominas", label: "Nóminas y trabajadores", descripcion: "Ver nóminas, descargar PDF, alta de trabajadores.", rutas: ["/cliente/laboral", "/cliente/nominas"], default: true },
  { key: "modelos", label: "Modelos AEAT", descripcion: "Borradores de 303, 130, 100, 111, etc.", rutas: ["/cliente/modelos"], default: true },
  { key: "bancos", label: "Bancos", descripcion: "Movimientos PSD2 y conciliación.", rutas: ["/cliente/bancos"], default: false },
  { key: "obligaciones", label: "Obligaciones", descripcion: "Calendario fiscal/laboral pendiente.", rutas: ["/cliente/obligaciones"], default: true },
  { key: "documentos", label: "Documentos", descripcion: "Modelos firmados y contratos.", rutas: ["/cliente/documentos"], default: true },
  { key: "solicitudes", label: "Solicitudes al gestor", descripcion: "Crear peticiones tipo (vacaciones, alta trabajador…).", rutas: ["/cliente/solicitudes"], default: true },
  { key: "chat", label: "Chat con asesor", descripcion: "Mensajería 1:1 con el equipo.", rutas: ["/cliente/chat"], default: true },
];

export function defaultModulos(alcance: Alcance): Record<string, boolean> {
  const list = alcance === "asesor" ? MODULOS_ASESOR : MODULOS_CLIENTE;
  return Object.fromEntries(list.map((m) => [m.key, m.default]));
}

/** Devuelve si un módulo está activo según la config (con fallback a default). */
export function moduloActivo(alcance: Alcance, config: Record<string, boolean> | null | undefined, key: string): boolean {
  if (config && key in config) return Boolean(config[key]);
  const list = alcance === "asesor" ? MODULOS_ASESOR : MODULOS_CLIENTE;
  return list.find((m) => m.key === key)?.default ?? true;
}

/** Mezcla la config guardada con los defaults para no perder claves nuevas. */
export function mergeWithDefaults(alcance: Alcance, config: Record<string, boolean> | null | undefined): Record<string, boolean> {
  const def = defaultModulos(alcance);
  return { ...def, ...(config ?? {}) };
}

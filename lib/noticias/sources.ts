/**
 * Fuentes oficiales que cubre la sección Noticias del gestor.
 *
 * El cron diario reparte la generación de artículos entre estas fuentes
 * para que el feed esté siempre actualizado con la actualidad pública
 * que un gestor fiscal/laboral/mercantil necesita seguir.
 */

/**
 * Categorías principales que el gestor fiscal/laboral/mercantil necesita.
 * El generador prioriza fiscal/contable/mercantil/laboral; subvenciones,
 * regulación y datos quedan como complemento.
 */
export type FuenteCategoria = "fiscal" | "contable" | "laboral" | "mercantil" | "subvenciones" | "regulacion" | "datos";

export type FuenteOficial = {
  codigo: string;
  nombre: string;
  url: string;
  categoria: FuenteCategoria;
  /** Sugerencias de temas que el generador debe priorizar. */
  temas: string[];
};

export const FUENTES_OFICIALES: FuenteOficial[] = [
  // FISCAL
  {
    codigo: "aeat",
    nombre: "Agencia Tributaria (AEAT)",
    url: "https://sede.agenciatributaria.gob.es",
    categoria: "fiscal",
    temas: [
      "novedades modelos AEAT", "plan control tributario", "campaña Renta",
      "campaña IVA", "Veri*Factu", "TicketBai", "calendario fiscal",
    ],
  },
  {
    codigo: "boe",
    nombre: "Boletín Oficial del Estado (BOE)",
    url: "https://www.boe.es",
    categoria: "regulacion",
    temas: ["leyes fiscales", "RD-Leyes", "presupuestos generales", "convenios colectivos"],
  },

  // LABORAL
  {
    codigo: "tgss",
    nombre: "Tesorería General de la Seguridad Social (TGSS)",
    url: "https://www.seg-social.es",
    categoria: "laboral",
    temas: ["bases cotización", "tipos cotización", "bonificaciones", "Sistema RED"],
  },
  {
    codigo: "importass",
    nombre: "Import@ss (autónomos)",
    url: "https://portal.seg-social.gob.es/importass",
    categoria: "laboral",
    temas: ["RETA", "cuota autónomos", "cese actividad", "tarifa plana", "rendimientos netos"],
  },
  {
    codigo: "sistema-red",
    nombre: "Sistema RED Seguridad Social",
    url: "https://www.seg-social.es/wps/portal/wss/internet/RedyAfiliacion",
    categoria: "laboral",
    temas: ["SILTRA", "CRA", "Delt@", "altas/bajas RED", "comunicación CRA"],
  },
  {
    codigo: "trabajo",
    nombre: "Ministerio de Trabajo y Economía Social",
    url: "https://www.mites.gob.es",
    categoria: "laboral",
    temas: ["SMI", "registro horario", "permiso parental", "convenios", "ERTE/ERE"],
  },

  // MERCANTIL
  {
    codigo: "rmc",
    nombre: "Registro Mercantil Central (RMC)",
    url: "https://www.rmc.es",
    categoria: "mercantil",
    temas: ["denominación social", "depósito cuentas anuales", "objeto social"],
  },
  {
    codigo: "borme",
    nombre: "Boletín Oficial del Registro Mercantil (BORME)",
    url: "https://www.boe.es/diario_borme",
    categoria: "mercantil",
    temas: ["constituciones", "ceses administradores", "nombramientos", "ampliaciones capital"],
  },
  {
    codigo: "circe",
    nombre: "CIRCE — creación de empresas",
    url: "https://www.circe.es",
    categoria: "mercantil",
    temas: ["DUE", "CIRCE", "constitución telemática", "PAE"],
  },
  {
    codigo: "registro-tit-reales",
    nombre: "Registro de Titularidades Reales",
    url: "https://www.registradores.org",
    categoria: "mercantil",
    temas: ["titular real", "ley 10/2010", "comunicación TR"],
  },
  {
    codigo: "registro-concursal",
    nombre: "Registro Público Concursal",
    url: "https://www.publicidadconcursal.es",
    categoria: "mercantil",
    temas: ["preconcurso", "concurso acreedores", "segunda oportunidad"],
  },

  // FINANCIERO / SUPERVISIÓN
  {
    codigo: "cirbe",
    nombre: "CIRBE - Banco de España",
    url: "https://app.bde.es/cir_www/",
    categoria: "regulacion",
    temas: ["riesgo crediticio", "informe CIRBE"],
  },
  {
    codigo: "cnmv",
    nombre: "CNMV",
    url: "https://www.cnmv.es",
    categoria: "regulacion",
    temas: ["hechos relevantes", "folletos", "supervisión mercados"],
  },
  {
    codigo: "sepblac",
    nombre: "SEPBLAC — prevención blanqueo",
    url: "https://www.sepblac.es",
    categoria: "regulacion",
    temas: ["PBC", "sujetos obligados", "informes operaciones sospechosas"],
  },

  // CONTRATACIÓN PÚBLICA / SUBVENCIONES
  {
    codigo: "contratacion-publica",
    nombre: "Plataforma de Contratación del Sector Público",
    url: "https://contrataciondelestado.es",
    categoria: "subvenciones",
    temas: ["licitaciones", "pliegos", "contratación pública"],
  },
  {
    codigo: "rolece",
    nombre: "ROLECE — Registro Oficial de Licitadores",
    url: "https://registrodelicitadores.gob.es",
    categoria: "subvenciones",
    temas: ["clasificación empresarial", "ROLECE inscripción"],
  },

  // DATOS / DIRECTORIOS
  {
    codigo: "ine-dirce",
    nombre: "INE — DIRCE",
    url: "https://www.ine.es",
    categoria: "datos",
    temas: ["estadística empresarial", "demografía empresarial"],
  },
  {
    codigo: "datos-gob",
    nombre: "datos.gob.es",
    url: "https://datos.gob.es",
    categoria: "datos",
    temas: ["open data administraciones", "datasets fiscales"],
  },

  // INFORMACIÓN COMERCIAL
  {
    codigo: "informa",
    nombre: "Informa D&B",
    url: "https://www.informa.es",
    categoria: "datos",
    temas: ["informes comerciales", "rating empresarial"],
  },
  {
    codigo: "axesor",
    nombre: "Axesor",
    url: "https://www.axesor.es",
    categoria: "datos",
    temas: ["informes financieros", "monitorización clientes"],
  },
  {
    codigo: "iberinform",
    nombre: "Iberinform",
    url: "https://www.iberinform.es",
    categoria: "datos",
    temas: ["riesgo comercial", "scoring"],
  },
  {
    codigo: "einforma",
    nombre: "eInforma",
    url: "https://www.einforma.com",
    categoria: "datos",
    temas: ["informes empresa", "cuentas depositadas"],
  },
];

export const CATEGORIA_LABEL: Record<FuenteCategoria, string> = {
  fiscal: "Fiscal",
  contable: "Contable",
  laboral: "Laboral",
  mercantil: "Mercantil",
  subvenciones: "Subvenciones",
  regulacion: "Regulación",
  datos: "Datos / Inform. comercial",
};

/** Categorías principales que el feed muestra por defecto. */
export const CATEGORIAS_PRIORITARIAS: FuenteCategoria[] = ["fiscal", "contable", "mercantil", "laboral"];

export function getFuente(codigo: string): FuenteOficial | undefined {
  return FUENTES_OFICIALES.find((f) => f.codigo === codigo);
}

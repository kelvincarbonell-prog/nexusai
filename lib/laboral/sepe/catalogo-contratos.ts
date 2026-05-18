/**
 * Catálogo SEPE de tipos de contrato.
 *
 * Fuente: SEPE — claves de los tipos de contrato vigentes tras la reforma
 * laboral 2022 (RD-Ley 32/2021). Las claves antiguas (501, 502…) están
 * derogadas y aparecen aquí solo a efectos históricos.
 */

export type TipoContratoSEPE = {
  codigo: string;
  nombre: string;
  modalidad: "indefinido" | "temporal" | "formativo" | "discontinuo" | "otros";
  jornada: "completa" | "parcial" | "ambas";
  vigente: boolean;
  descripcion: string;
  /** ¿Genera derecho a bonificación SS por defecto? */
  bonificable_default?: boolean;
  /** Indemnización por extinción en días por año (orientativo). */
  indemnizacion_dias_anyo?: number;
};

export const TIPOS_CONTRATO_SEPE: TipoContratoSEPE[] = [
  // ===== INDEFINIDOS =====
  {
    codigo: "100",
    nombre: "Indefinido ordinario · tiempo completo",
    modalidad: "indefinido",
    jornada: "completa",
    vigente: true,
    descripcion: "Sin término. Sin causa de temporalidad.",
    indemnizacion_dias_anyo: 20,
  },
  {
    codigo: "189",
    nombre: "Indefinido ordinario · tiempo parcial",
    modalidad: "indefinido",
    jornada: "parcial",
    vigente: true,
    descripcion: "Indefinido con jornada parcial.",
    indemnizacion_dias_anyo: 20,
  },
  {
    codigo: "150",
    nombre: "Indefinido fijo-discontinuo",
    modalidad: "discontinuo",
    jornada: "ambas",
    vigente: true,
    descripcion: "Trabajos de naturaleza estacional o intermitente. Sustituye al 510 antiguo.",
    indemnizacion_dias_anyo: 20,
  },
  {
    codigo: "139",
    nombre: "Indefinido a personas con discapacidad",
    modalidad: "indefinido",
    jornada: "ambas",
    vigente: true,
    descripcion: "≥33% discapacidad. Bonificación SS 4.500-6.300€/año.",
    bonificable_default: true,
    indemnizacion_dias_anyo: 20,
  },
  // ===== TEMPORALES (post-reforma 2022) =====
  {
    codigo: "401",
    nombre: "Por circunstancias de la producción · ocasional",
    modalidad: "temporal",
    jornada: "ambas",
    vigente: true,
    descripcion: "Imprevisibles e incremento ocasional. Máx 6 meses (12 con convenio).",
    indemnizacion_dias_anyo: 12,
  },
  {
    codigo: "402",
    nombre: "Por circunstancias de la producción · previsibles",
    modalidad: "temporal",
    jornada: "ambas",
    vigente: true,
    descripcion: "Situaciones previsibles. Máx 90 días/año, no consecutivos.",
    indemnizacion_dias_anyo: 12,
  },
  {
    codigo: "410",
    nombre: "Por sustitución de persona trabajadora",
    modalidad: "temporal",
    jornada: "ambas",
    vigente: true,
    descripcion: "Sustituir a trabajador con reserva de puesto (IT, maternidad, excedencia…).",
    indemnizacion_dias_anyo: 12,
  },
  {
    codigo: "420",
    nombre: "Por sustitución para completar jornada reducida",
    modalidad: "temporal",
    jornada: "ambas",
    vigente: true,
    descripcion: "Cubrir jornada reducida por motivo legalmente previsto.",
    indemnizacion_dias_anyo: 12,
  },
  // ===== FORMATIVOS =====
  {
    codigo: "421",
    nombre: "Formativo en alternancia",
    modalidad: "formativo",
    jornada: "ambas",
    vigente: true,
    descripcion: "Compagina trabajo y formación. <30 años, salario proporcional.",
    bonificable_default: true,
    indemnizacion_dias_anyo: 0,
  },
  {
    codigo: "521",
    nombre: "Formativo para obtención de práctica profesional",
    modalidad: "formativo",
    jornada: "ambas",
    vigente: true,
    descripcion: "Sustituye al 'prácticas' antiguo. 3 años desde titulación.",
    bonificable_default: true,
    indemnizacion_dias_anyo: 0,
  },
  // ===== OTROS =====
  {
    codigo: "108",
    nombre: "Indefinido por conversión de temporal",
    modalidad: "indefinido",
    jornada: "ambas",
    vigente: true,
    descripcion: "Conversión a indefinido. Bonificación SS según colectivo.",
    bonificable_default: true,
    indemnizacion_dias_anyo: 20,
  },
  {
    codigo: "189",
    nombre: "Indefinido fomento empleo · ≥45 años parados larga duración",
    modalidad: "indefinido",
    jornada: "ambas",
    vigente: true,
    descripcion: "Bonificación 1.300€/año durante 3 años.",
    bonificable_default: true,
    indemnizacion_dias_anyo: 20,
  },
];

export function getTipoContrato(codigo: string): TipoContratoSEPE | undefined {
  return TIPOS_CONTRATO_SEPE.find((t) => t.codigo === codigo);
}

export function tiposContratoPorModalidad(): Record<TipoContratoSEPE["modalidad"], TipoContratoSEPE[]> {
  return {
    indefinido: TIPOS_CONTRATO_SEPE.filter((t) => t.modalidad === "indefinido"),
    temporal: TIPOS_CONTRATO_SEPE.filter((t) => t.modalidad === "temporal"),
    formativo: TIPOS_CONTRATO_SEPE.filter((t) => t.modalidad === "formativo"),
    discontinuo: TIPOS_CONTRATO_SEPE.filter((t) => t.modalidad === "discontinuo"),
    otros: TIPOS_CONTRATO_SEPE.filter((t) => t.modalidad === "otros"),
  };
}

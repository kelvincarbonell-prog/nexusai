/**
 * Catálogo de tipos de solicitud que un cliente puede enviar a su gestor.
 * Dividido en laboral y fiscal/contable. Cada tipo tiene un grupo, label,
 * descripción corta para el cliente y prioridad por defecto.
 */

export type CampoSolicitud =
  | { tipo: "trabajador"; label: string; required?: boolean; help?: string }
  | { tipo: "periodo_trim"; label: string; required?: boolean }
  | { tipo: "periodo_mes"; label: string; required?: boolean }
  | { tipo: "anyo"; label: string; required?: boolean }
  | { tipo: "factura"; label: string; required?: boolean }
  | { tipo: "fecha"; label: string; required?: boolean }
  | { tipo: "texto"; label: string; required?: boolean; placeholder?: string; maxLength?: number }
  | { tipo: "numero"; label: string; required?: boolean; placeholder?: string; min?: number; max?: number; suffix?: string }
  | { tipo: "select"; label: string; required?: boolean; opciones: Array<{ value: string; label: string }> }
  | { tipo: "documento"; label: string; required?: boolean; help?: string };

export type CatalogoSolicitud = {
  key: string;
  grupo: "laboral" | "fiscal" | "general";
  label: string;
  descripcion: string;
  icon: string;            // lucide icon name
  prioridad_default: "normal" | "alta" | "urgente";
  requiere_documento?: boolean;
  /** Campos contextuales que se piden al cliente al seleccionar este tipo. */
  campos?: CampoSolicitud[];
  /** Sugerencias para correlaciones inteligentes (preselecciona el trabajador,
   *  factura, periodo más probable basado en datos recientes del cliente). */
  sugerir?: ("trabajador_reciente" | "periodo_actual" | "ultima_factura")[];
};

export const CATALOGO_SOLICITUDES: CatalogoSolicitud[] = [
  // --- LABORAL ---
  {
    key: "alta_ss",
    grupo: "laboral",
    label: "Alta trabajador en Seguridad Social",
    descripcion: "Dar de alta un nuevo trabajador.",
    icon: "UserPlus",
    prioridad_default: "alta",
    requiere_documento: true,
    campos: [
      { tipo: "texto", label: "Nombre completo del trabajador", required: true, placeholder: "Nombre y apellidos" },
      { tipo: "texto", label: "DNI / NIE", required: true, placeholder: "12345678A" },
      { tipo: "fecha", label: "Fecha prevista de alta", required: true },
      { tipo: "select", label: "Tipo de contrato", required: true, opciones: [
        { value: "100", label: "Indefinido tiempo completo" },
        { value: "189", label: "Indefinido tiempo parcial" },
        { value: "401", label: "Temporal por producción" },
        { value: "421", label: "Formativo en alternancia" },
        { value: "521", label: "Práctica profesional" },
      ] },
      { tipo: "numero", label: "Salario bruto anual", required: true, placeholder: "20000", suffix: "€" },
      { tipo: "numero", label: "Jornada semanal", required: true, placeholder: "40", suffix: "h", min: 1, max: 60 },
      { tipo: "documento", label: "Adjuntar DNI + IBAN trabajador", required: true, help: "Foto o PDF del DNI por ambas caras y el IBAN donde cobrará." },
    ],
  },
  {
    key: "baja_ss",
    grupo: "laboral",
    label: "Baja trabajador en Seguridad Social",
    descripcion: "Tramitar la baja del trabajador.",
    icon: "UserMinus",
    prioridad_default: "alta",
    campos: [
      { tipo: "trabajador", label: "Trabajador a dar de baja", required: true, help: "Selecciona el empleado de tu plantilla." },
      { tipo: "fecha", label: "Fecha efectiva de baja", required: true },
      { tipo: "select", label: "Motivo", required: true, opciones: [
        { value: "fin_contrato", label: "Fin de contrato" },
        { value: "baja_voluntaria", label: "Baja voluntaria" },
        { value: "despido_objetivo", label: "Despido objetivo" },
        { value: "despido_improcedente", label: "Despido improcedente" },
        { value: "despido_disciplinario", label: "Despido disciplinario" },
        { value: "jubilacion", label: "Jubilación" },
        { value: "mutuo_acuerdo", label: "Mutuo acuerdo" },
      ] },
    ],
    sugerir: ["trabajador_reciente"],
  },
  {
    key: "it_baja",
    grupo: "laboral",
    label: "Parte de baja por IT",
    descripcion: "Comunicar la baja médica de un trabajador.",
    icon: "HeartPulse",
    prioridad_default: "urgente",
    requiere_documento: true,
    campos: [
      { tipo: "trabajador", label: "Trabajador en baja médica", required: true },
      { tipo: "fecha", label: "Fecha del parte (primer día baja)", required: true },
      { tipo: "select", label: "Contingencia", required: true, opciones: [
        { value: "cc", label: "Común (enfermedad)" },
        { value: "ep", label: "Enfermedad profesional" },
        { value: "atrabajo", label: "Accidente de trabajo" },
        { value: "atrayecto", label: "Accidente in itinere" },
      ] },
      { tipo: "numero", label: "Duración estimada (días)", required: false, placeholder: "7", min: 1, max: 540 },
      { tipo: "documento", label: "Foto/PDF del parte médico", required: true, help: "El parte que te dio el médico de cabecera o la mutua." },
    ],
    sugerir: ["trabajador_reciente"],
  },
  {
    key: "it_alta",
    grupo: "laboral",
    label: "Parte de alta médica (fin de IT)",
    descripcion: "Vuelta al trabajo tras IT.",
    icon: "Activity",
    prioridad_default: "normal",
    requiere_documento: true,
    campos: [
      { tipo: "trabajador", label: "Trabajador", required: true },
      { tipo: "fecha", label: "Fecha de alta médica", required: true },
      { tipo: "documento", label: "Parte de alta", required: true },
    ],
  },
  {
    key: "vacaciones",
    grupo: "laboral",
    label: "Solicitud de vacaciones",
    descripcion: "Calendario de vacaciones de un trabajador.",
    icon: "Sun",
    prioridad_default: "normal",
    campos: [
      { tipo: "trabajador", label: "Trabajador", required: true },
      { tipo: "fecha", label: "Fecha inicio", required: true },
      { tipo: "fecha", label: "Fecha fin", required: true },
    ],
    sugerir: ["trabajador_reciente"],
  },
  {
    key: "modificacion_contrato",
    grupo: "laboral",
    label: "Modificación de contrato",
    descripcion: "Cambio de jornada, salario o categoría.",
    icon: "FileSignature",
    prioridad_default: "alta",
    campos: [
      { tipo: "trabajador", label: "Trabajador", required: true },
      { tipo: "select", label: "Qué se modifica", required: true, opciones: [
        { value: "jornada", label: "Jornada (horas semanales)" },
        { value: "salario", label: "Salario" },
        { value: "categoria", label: "Categoría profesional" },
        { value: "tipo_contrato", label: "Tipo de contrato (indefinido/temporal)" },
        { value: "puesto", label: "Puesto de trabajo" },
      ] },
      { tipo: "fecha", label: "Fecha efectiva del cambio", required: true },
      { tipo: "texto", label: "Detalle del cambio (de X a Y)", required: true, placeholder: "Ej. de 20 a 40 h/semana" },
    ],
  },
  {
    key: "finiquito",
    grupo: "laboral",
    label: "Cálculo de finiquito",
    descripcion: "Calcular finiquito por baja voluntaria, despido o fin de contrato.",
    icon: "Receipt",
    prioridad_default: "alta",
    campos: [
      { tipo: "trabajador", label: "Trabajador", required: true },
      { tipo: "fecha", label: "Último día trabajado", required: true },
      { tipo: "select", label: "Tipo de extinción", required: true, opciones: [
        { value: "fin_temporal", label: "Fin de contrato temporal" },
        { value: "baja_voluntaria", label: "Baja voluntaria" },
        { value: "despido_objetivo", label: "Despido objetivo" },
        { value: "despido_improcedente", label: "Despido improcedente" },
        { value: "despido_disciplinario", label: "Despido disciplinario" },
        { value: "jubilacion", label: "Jubilación" },
      ] },
    ],
    sugerir: ["trabajador_reciente"],
  },
  {
    key: "certificado_empresa",
    grupo: "laboral",
    label: "Certificado de empresa (paro)",
    descripcion: "Para que el trabajador solicite la prestación por desempleo.",
    icon: "FileText",
    prioridad_default: "alta",
    campos: [
      { tipo: "trabajador", label: "Trabajador", required: true },
      { tipo: "fecha", label: "Último día trabajado", required: true },
    ],
  },
  {
    key: "convenio",
    grupo: "laboral",
    label: "Consulta sobre convenio colectivo",
    descripcion: "Dudas sobre aplicación del convenio, salarios mínimos, complementos.",
    icon: "BookOpen",
    prioridad_default: "normal",
  },
  {
    key: "nominas",
    grupo: "laboral",
    label: "Revisión de nóminas",
    descripcion: "Revisar y validar las nóminas del mes.",
    icon: "Banknote",
    prioridad_default: "normal",
    campos: [
      { tipo: "periodo_mes", label: "Mes a revisar", required: true },
      { tipo: "trabajador", label: "Trabajador concreto (opcional)", required: false, help: "Si es general, déjalo vacío." },
    ],
    sugerir: ["periodo_actual"],
  },

  // --- FISCAL / CONTABLE ---
  {
    key: "alta_autonomo",
    grupo: "fiscal",
    label: "Alta como autónomo (036/037)",
    descripcion: "Iniciar actividad como autónomo. Indica fecha de inicio y epígrafe.",
    icon: "Briefcase",
    prioridad_default: "alta",
  },
  {
    key: "baja_autonomo",
    grupo: "fiscal",
    label: "Baja de autónomo",
    descripcion: "Cese de actividad y baja en RETA.",
    icon: "DoorClosed",
    prioridad_default: "alta",
  },
  {
    key: "iva_trimestral",
    grupo: "fiscal",
    label: "Presentar IVA trimestral (modelo 303)",
    descripcion: "Liquidación trimestral del IVA. Confirma que todos los gastos están subidos.",
    icon: "Calculator",
    prioridad_default: "normal",
    campos: [
      { tipo: "periodo_trim", label: "Trimestre a liquidar", required: true },
    ],
    sugerir: ["periodo_actual"],
  },
  {
    key: "irpf_trimestral",
    grupo: "fiscal",
    label: "Pago fraccionado IRPF (130)",
    descripcion: "Pago a cuenta trimestral del IRPF para autónomos.",
    icon: "Percent",
    prioridad_default: "normal",
    campos: [
      { tipo: "periodo_trim", label: "Trimestre", required: true },
    ],
    sugerir: ["periodo_actual"],
  },
  {
    key: "retenciones_111",
    grupo: "fiscal",
    label: "Retenciones IRPF trabajadores y profesionales (111)",
    descripcion: "Ingreso trimestral de retenciones practicadas.",
    icon: "FileText",
    prioridad_default: "normal",
    campos: [
      { tipo: "periodo_trim", label: "Trimestre", required: true },
    ],
    sugerir: ["periodo_actual"],
  },
  {
    key: "alquileres_115",
    grupo: "fiscal",
    label: "Retenciones por alquileres (115)",
    descripcion: "Ingreso trimestral de retenciones sobre alquileres de locales.",
    icon: "Building2",
    prioridad_default: "normal",
    campos: [
      { tipo: "periodo_trim", label: "Trimestre", required: true },
    ],
    sugerir: ["periodo_actual"],
  },
  {
    key: "modelo_347",
    grupo: "fiscal",
    label: "Operaciones con terceros (347)",
    descripcion: "Declaración anual de operaciones >3.005,06€ por cliente/proveedor.",
    icon: "FileSpreadsheet",
    prioridad_default: "normal",
    campos: [
      { tipo: "anyo", label: "Ejercicio", required: true },
    ],
  },
  {
    key: "modelo_349",
    grupo: "fiscal",
    label: "Operaciones intracomunitarias (349)",
    descripcion: "Operaciones con clientes/proveedores de la UE.",
    icon: "Globe",
    prioridad_default: "normal",
    campos: [
      { tipo: "periodo_mes", label: "Mes o trimestre", required: true },
    ],
  },
  {
    key: "renta",
    grupo: "fiscal",
    label: "Declaración de la Renta (100)",
    descripcion: "Preparar y presentar la declaración del IRPF anual.",
    icon: "FileCheck2",
    prioridad_default: "alta",
    campos: [
      { tipo: "anyo", label: "Ejercicio", required: true },
    ],
  },
  {
    key: "sociedades",
    grupo: "fiscal",
    label: "Impuesto de Sociedades (200)",
    descripcion: "Declaración anual del Impuesto sobre Sociedades.",
    icon: "Landmark",
    prioridad_default: "alta",
    campos: [
      { tipo: "anyo", label: "Ejercicio", required: true },
    ],
  },
  {
    key: "certificados_tributarios",
    grupo: "fiscal",
    label: "Certificado tributario AEAT",
    descripcion: "Solicitar certificado de estar al corriente de pagos.",
    icon: "ShieldCheck",
    prioridad_default: "normal",
  },
  {
    key: "factura_rectificativa",
    grupo: "fiscal",
    label: "Emisión de factura rectificativa",
    descripcion: "Anular o corregir una factura ya emitida.",
    icon: "FilePen",
    prioridad_default: "alta",
    campos: [
      { tipo: "factura", label: "Factura original a rectificar", required: true },
      { tipo: "select", label: "Motivo", required: true, opciones: [
        { value: "anulacion", label: "Anulación completa" },
        { value: "error_importe", label: "Error de importe" },
        { value: "error_datos", label: "Error de datos cliente" },
        { value: "devolucion", label: "Devolución de mercancía" },
        { value: "descuento", label: "Descuento posterior" },
      ] },
      { tipo: "texto", label: "Detalle", required: false, placeholder: "Explica brevemente el error o devolución" },
    ],
    sugerir: ["ultima_factura"],
  },
  {
    key: "presupuesto",
    grupo: "fiscal",
    label: "Solicitar presupuesto",
    descripcion: "Presupuesto para nuevo servicio o ampliación.",
    icon: "FileQuestion",
    prioridad_default: "normal",
  },

  // --- GENERAL ---
  {
    key: "documento",
    grupo: "general",
    label: "Pedir documento",
    descripcion: "Solicitar copia de algún documento (factura, contrato, modelo presentado…).",
    icon: "Files",
    prioridad_default: "normal",
  },
  {
    key: "general",
    grupo: "general",
    label: "Consulta general",
    descripcion: "Pregunta abierta o duda que no encaja en las categorías anteriores.",
    icon: "MessageCircle",
    prioridad_default: "normal",
  },
];

export function getSolicitudByKey(key: string): CatalogoSolicitud | undefined {
  return CATALOGO_SOLICITUDES.find((s) => s.key === key);
}

export function solicitudesByGrupo(): Record<"laboral" | "fiscal" | "general", CatalogoSolicitud[]> {
  return {
    laboral: CATALOGO_SOLICITUDES.filter((s) => s.grupo === "laboral"),
    fiscal: CATALOGO_SOLICITUDES.filter((s) => s.grupo === "fiscal"),
    general: CATALOGO_SOLICITUDES.filter((s) => s.grupo === "general"),
  };
}

/**
 * Catálogo de tipos de solicitud que un cliente puede enviar a su gestor.
 * Dividido en laboral y fiscal/contable. Cada tipo tiene un grupo, label,
 * descripción corta para el cliente y prioridad por defecto.
 */

export type CatalogoSolicitud = {
  key: string;
  grupo: "laboral" | "fiscal" | "general";
  label: string;
  descripcion: string;
  icon: string;            // lucide icon name
  prioridad_default: "normal" | "alta" | "urgente";
  requiere_documento?: boolean;
};

export const CATALOGO_SOLICITUDES: CatalogoSolicitud[] = [
  // --- LABORAL ---
  {
    key: "alta_ss",
    grupo: "laboral",
    label: "Alta trabajador en Seguridad Social",
    descripcion: "Dar de alta un nuevo trabajador. Necesitamos DNI, IBAN y tipo de contrato.",
    icon: "UserPlus",
    prioridad_default: "alta",
    requiere_documento: true,
  },
  {
    key: "baja_ss",
    grupo: "laboral",
    label: "Baja trabajador en Seguridad Social",
    descripcion: "Tramitar la baja por fin de contrato, despido o jubilación.",
    icon: "UserMinus",
    prioridad_default: "alta",
  },
  {
    key: "it_baja",
    grupo: "laboral",
    label: "Parte de baja por IT",
    descripcion: "Comunicar la baja médica de un trabajador (incapacidad temporal).",
    icon: "HeartPulse",
    prioridad_default: "urgente",
    requiere_documento: true,
  },
  {
    key: "it_alta",
    grupo: "laboral",
    label: "Parte de alta médica (fin de IT)",
    descripcion: "Notificar la vuelta al trabajo del empleado en baja.",
    icon: "Activity",
    prioridad_default: "normal",
    requiere_documento: true,
  },
  {
    key: "vacaciones",
    grupo: "laboral",
    label: "Solicitud de vacaciones",
    descripcion: "Comunicar el calendario de vacaciones de un trabajador.",
    icon: "PalmTree",
    prioridad_default: "normal",
  },
  {
    key: "modificacion_contrato",
    grupo: "laboral",
    label: "Modificación de contrato",
    descripcion: "Cambio de jornada, salario, categoría o tipo de contrato.",
    icon: "FileSignature",
    prioridad_default: "alta",
  },
  {
    key: "finiquito",
    grupo: "laboral",
    label: "Cálculo de finiquito",
    descripcion: "Calcular finiquito por baja voluntaria, despido o fin de contrato.",
    icon: "Receipt",
    prioridad_default: "alta",
  },
  {
    key: "certificado_empresa",
    grupo: "laboral",
    label: "Certificado de empresa (paro)",
    descripcion: "Emitir certificado para que el trabajador solicite la prestación por desempleo.",
    icon: "FileText",
    prioridad_default: "alta",
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
  },
  {
    key: "irpf_trimestral",
    grupo: "fiscal",
    label: "Pago fraccionado IRPF (130/131)",
    descripcion: "Pago a cuenta trimestral del IRPF para autónomos.",
    icon: "Percent",
    prioridad_default: "normal",
  },
  {
    key: "retenciones_111",
    grupo: "fiscal",
    label: "Retenciones IRPF trabajadores y profesionales (111)",
    descripcion: "Ingreso trimestral de retenciones practicadas.",
    icon: "FileText",
    prioridad_default: "normal",
  },
  {
    key: "alquileres_115",
    grupo: "fiscal",
    label: "Retenciones por alquileres (115)",
    descripcion: "Ingreso trimestral de retenciones sobre alquileres de locales.",
    icon: "Building2",
    prioridad_default: "normal",
  },
  {
    key: "modelo_347",
    grupo: "fiscal",
    label: "Operaciones con terceros (347)",
    descripcion: "Declaración anual de operaciones >3.005,06€ por cliente/proveedor.",
    icon: "FileSpreadsheet",
    prioridad_default: "normal",
  },
  {
    key: "modelo_349",
    grupo: "fiscal",
    label: "Operaciones intracomunitarias (349)",
    descripcion: "Operaciones con clientes/proveedores de la UE.",
    icon: "Globe",
    prioridad_default: "normal",
  },
  {
    key: "renta",
    grupo: "fiscal",
    label: "Declaración de la Renta (100)",
    descripcion: "Preparar y presentar la declaración del IRPF anual.",
    icon: "FileCheck2",
    prioridad_default: "alta",
  },
  {
    key: "sociedades",
    grupo: "fiscal",
    label: "Impuesto de Sociedades (200)",
    descripcion: "Declaración anual del Impuesto sobre Sociedades.",
    icon: "Landmark",
    prioridad_default: "alta",
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

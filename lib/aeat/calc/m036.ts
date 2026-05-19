/**
 * Modelo 036 — Declaración Censal (alta/modificación/baja).
 *
 * El 036 es el censo oficial de actividades económicas en AEAT.
 * Se presenta:
 *   - Alta (causa 100)
 *   - Modificación de datos (causa 122 cambio domicilio, 125 nuevo IAE, etc.)
 *   - Baja (causa 150)
 *
 * El 037 es la versión simplificada del 036 (solo personas físicas con
 * actividad sencilla, sin grupo IVA, sin gran empresa, sin REA…).
 *
 * NOTA: el 036 NO es un cálculo numérico. Es un formulario de DATOS
 * MAESTROS. Aquí lo modelamos como una declaración con bloques que el
 * gestor rellena (cabecera, IAE, IVA, IRPF, retenciones, almacenes…).
 */

export type Modelo036Input = {
  causa: "alta" | "modificacion" | "baja";
  motivos_modificacion?: string[]; // claves p. ej. ["domicilio", "iae"]
  fecha_efectos: string; // YYYY-MM-DD

  // Datos identificativos
  nif: string;
  apellidos_razon: string;
  nombre?: string;       // solo personas físicas
  forma_juridica?: string;
  fecha_constitucion?: string;
  domicilio_fiscal?: string;
  cp?: string;
  municipio?: string;
  provincia?: string;
  telefono?: string;
  email?: string;

  // Actividades económicas
  iaes?: Array<{ epigrafe: string; descripcion: string; fecha_inicio: string; principal: boolean }>;

  // IVA
  regimen_iva?: "general" | "simplificado" | "rea" | "recargo_equivalencia" | "agricola" | "exento";
  inicio_iva?: string;

  // IRPF
  regimen_irpf?: "estimacion_directa_normal" | "estimacion_directa_simplificada" | "estimacion_objetiva" | "no_aplica";
  inicio_irpf?: string;

  // Retenciones (obligación de retener)
  obligado_retener?: boolean;

  // Local / almacén afecto
  locales?: Array<{ direccion: string; superficie_m2?: number; uso: "principal" | "almacen" | "produccion" }>;

  // Operaciones intracomunitarias (alta en ROI)
  alta_roi?: boolean;
};

export type Casillas036 = {
  // Cabecera con causa de presentación
  causa: string;
  fecha_efectos: string;
  // Resumen estructurado
  nif: string;
  nombre: string;
  regimen_iva: string;
  regimen_irpf: string;
  num_iaes: number;
  num_locales: number;
  alta_roi: boolean;
  obligado_retener: boolean;
};

export function calcular036(input: Modelo036Input): {
  casillas: Casillas036;
  warnings: string[];
  resumen: Record<string, unknown>;
} {
  const warnings: string[] = [];

  // Validaciones mínimas
  if (!input.nif) warnings.push("Falta NIF en la declaración.");
  if (!input.apellidos_razon) warnings.push("Falta apellidos / razón social.");
  if (!input.fecha_efectos) warnings.push("Falta fecha de efectos.");
  if (input.causa === "alta" && !input.iaes?.length) warnings.push("El alta censal debe declarar al menos un IAE.");
  if (input.causa === "modificacion" && !input.motivos_modificacion?.length) {
    warnings.push("Las modificaciones deben indicar al menos un motivo (domicilio, IAE, IVA, IRPF…).");
  }
  if (input.alta_roi && !input.iaes?.length) {
    warnings.push("Para alta en ROI (operaciones intracomunitarias) es necesario tener IAE declarado.");
  }
  if (input.regimen_iva === "agricola" && (input.iaes ?? []).some((i) => !i.epigrafe.startsWith("01"))) {
    warnings.push("Régimen IVA agrícola sin IAE de la sección 01 (actividades agrarias).");
  }

  const casillas: Casillas036 = {
    causa: input.causa,
    fecha_efectos: input.fecha_efectos,
    nif: input.nif,
    nombre: (input.nombre ? `${input.nombre} ${input.apellidos_razon}` : input.apellidos_razon).trim(),
    regimen_iva: input.regimen_iva ?? "general",
    regimen_irpf: input.regimen_irpf ?? "no_aplica",
    num_iaes: input.iaes?.length ?? 0,
    num_locales: input.locales?.length ?? 0,
    alta_roi: Boolean(input.alta_roi),
    obligado_retener: Boolean(input.obligado_retener),
  };

  return {
    casillas,
    warnings,
    resumen: {
      causa: input.causa,
      motivos: input.motivos_modificacion ?? [],
      iaes: input.iaes ?? [],
      locales: input.locales ?? [],
      inputs_aplicados: input,
    },
  };
}

/**
 * 037 — versión simplificada del 036. Solo personas físicas, sin grupo IVA,
 * sin REA, sin gran empresa. Internamente reutiliza calcular036 con validación
 * más estricta de elegibilidad.
 */
export function calcular037(input: Modelo036Input): {
  casillas: Casillas036;
  warnings: string[];
  resumen: Record<string, unknown>;
} {
  const base = calcular036(input);
  const warns = [...base.warnings];

  // Restricciones del 037 (sólo elegible si NO se da ninguna de estas):
  if (input.forma_juridica && !/^(persona f|aut[oó]nomo)/i.test(input.forma_juridica)) {
    warns.push("El 037 sólo es válido para personas físicas. Usa el 036 para sociedades.");
  }
  if (input.regimen_iva === "rea") {
    warns.push("Régimen Especial Agrario (REA): debe usar el 036, no el 037.");
  }

  return { ...base, warnings: warns, resumen: { ...base.resumen, version: "simplificada" } };
}

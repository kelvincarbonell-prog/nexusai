/**
 * Cálculo de indemnización por extinción de contrato.
 *
 * Reglas:
 *  - Despido objetivo: 20 días/año, máximo 12 mensualidades.
 *  - Despido improcedente (causa no probada):
 *      * Contratos celebrados desde 12/02/2012: 33 días/año, máx 24 mensualidades.
 *      * Contratos anteriores: 45 días/año hasta 12/02/2012 + 33 días/año desde,
 *        máx 42 mensualidades.
 *  - Despido disciplinario procedente: sin indemnización.
 *  - Fin de contrato temporal: 12 días/año (post 2022).
 *  - Resolución empresarial vía art. 41/51: 20 días/año, máx 9 mens.
 *  - Baja voluntaria / jubilación: sin indemnización.
 */

export type TipoExtincion =
  | "despido_objetivo"
  | "despido_improcedente"
  | "despido_disciplinario_procedente"
  | "fin_temporal"
  | "modificacion_sustancial"
  | "baja_voluntaria"
  | "jubilacion"
  | "mutuo_acuerdo";

export type IndemnizacionInput = {
  tipo: TipoExtincion;
  salario_anual_bruto: number;       // bruto anual con extras
  fecha_inicio: string;              // YYYY-MM-DD (alta efectiva)
  fecha_fin: string;                 // YYYY-MM-DD (último día)
  /** Si el contrato fue celebrado antes de 12/02/2012, marca true para el régimen mixto. */
  pre_2012?: boolean;
};

export type IndemnizacionResult = {
  tipo: TipoExtincion;
  anyos_servicio: number;
  dias_servicio: number;
  salario_diario: number;
  dias_por_anyo: number;
  base_calculo: number;
  topes: { aplicado: boolean; meses_max?: number; importe_max?: number };
  importe_neto: number;
  desglose: Array<{ periodo: string; dias_anyo: number; anyos: number; importe: number }>;
  nota: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const CORTE_2012 = "2012-02-12";

function diffYears(from: string, to: string): { years: number; days: number } {
  const a = new Date(from + "T00:00:00").getTime();
  const b = new Date(to + "T00:00:00").getTime();
  const dias = Math.max(0, Math.floor((b - a) / 86_400_000));
  return { years: dias / 365.25, days: dias };
}

function indemDiasPorAnyo(tipo: TipoExtincion): number {
  switch (tipo) {
    case "despido_objetivo":
    case "modificacion_sustancial":
      return 20;
    case "despido_improcedente":
      return 33;
    case "fin_temporal":
      return 12;
    default:
      return 0;
  }
}

function mesesMaximos(tipo: TipoExtincion): number | undefined {
  if (tipo === "despido_objetivo") return 12;
  if (tipo === "modificacion_sustancial") return 9;
  if (tipo === "despido_improcedente") return 24;
  return undefined;
}

export function calcularIndemnizacion(input: IndemnizacionInput): IndemnizacionResult {
  const { tipo, salario_anual_bruto, fecha_inicio, fecha_fin } = input;
  const { years, days } = diffYears(fecha_inicio, fecha_fin);
  const salarioDiario = salario_anual_bruto / 365;
  const desglose: IndemnizacionResult["desglose"] = [];

  if (tipo === "baja_voluntaria" || tipo === "jubilacion" || tipo === "mutuo_acuerdo" || tipo === "despido_disciplinario_procedente") {
    return {
      tipo,
      anyos_servicio: round2(years),
      dias_servicio: days,
      salario_diario: round2(salarioDiario),
      dias_por_anyo: 0,
      base_calculo: 0,
      topes: { aplicado: false },
      importe_neto: 0,
      desglose: [],
      nota: "Esta causa de extinción no genera derecho a indemnización legal.",
    };
  }

  let importeBase = 0;
  let diasPorAnyoMostrar = indemDiasPorAnyo(tipo);

  // Caso especial: improcedente con contrato pre-2012 (régimen mixto 45+33)
  if (tipo === "despido_improcedente" && input.pre_2012) {
    const fInicio = new Date(fecha_inicio + "T00:00:00");
    const fCorte = new Date(CORTE_2012 + "T00:00:00");
    const fFin = new Date(fecha_fin + "T00:00:00");
    if (fInicio < fCorte) {
      const yearsAnt = Math.max(0, (Math.min(fCorte.getTime(), fFin.getTime()) - fInicio.getTime()) / 86_400_000 / 365.25);
      const yearsDesp = Math.max(0, (fFin.getTime() - Math.max(fCorte.getTime(), fInicio.getTime())) / 86_400_000 / 365.25);
      const importeAnt = yearsAnt * 45 * salarioDiario;
      const importeDesp = yearsDesp * 33 * salarioDiario;
      importeBase = importeAnt + importeDesp;
      desglose.push({ periodo: `${fecha_inicio} → ${CORTE_2012}`, dias_anyo: 45, anyos: round2(yearsAnt), importe: round2(importeAnt) });
      desglose.push({ periodo: `${CORTE_2012} → ${fecha_fin}`, dias_anyo: 33, anyos: round2(yearsDesp), importe: round2(importeDesp) });
      diasPorAnyoMostrar = -1; // mixto
    } else {
      importeBase = years * 33 * salarioDiario;
      desglose.push({ periodo: `${fecha_inicio} → ${fecha_fin}`, dias_anyo: 33, anyos: round2(years), importe: round2(importeBase) });
    }
  } else {
    importeBase = years * diasPorAnyoMostrar * salarioDiario;
    desglose.push({ periodo: `${fecha_inicio} → ${fecha_fin}`, dias_anyo: diasPorAnyoMostrar, anyos: round2(years), importe: round2(importeBase) });
  }

  // Aplicar tope en mensualidades
  const mesesMax = mesesMaximos(tipo);
  let aplicado = false;
  let importeMax: number | undefined;
  if (mesesMax !== undefined) {
    importeMax = (salario_anual_bruto / 12) * mesesMax;
    if (importeBase > importeMax) {
      aplicado = true;
      importeBase = importeMax;
    }
  }
  // Régimen mixto pre-2012: el tope es 42 mensualidades específico
  if (tipo === "despido_improcedente" && input.pre_2012) {
    const tope42 = (salario_anual_bruto / 12) * 42;
    if (importeBase > tope42) {
      aplicado = true;
      importeMax = tope42;
      importeBase = tope42;
    }
  }

  return {
    tipo,
    anyos_servicio: round2(years),
    dias_servicio: days,
    salario_diario: round2(salarioDiario),
    dias_por_anyo: diasPorAnyoMostrar === -1 ? 0 : diasPorAnyoMostrar,
    base_calculo: round2(salario_anual_bruto),
    topes: { aplicado, meses_max: mesesMax, importe_max: importeMax ? round2(importeMax) : undefined },
    importe_neto: round2(importeBase),
    desglose,
    nota:
      tipo === "despido_improcedente" && input.pre_2012
        ? "Régimen mixto contratos anteriores a 12/02/2012: 45 d/año hasta el corte + 33 d/año posterior. Tope 42 mensualidades."
        : "Cálculo orientativo según ET. Verifica convenio colectivo aplicable.",
  };
}

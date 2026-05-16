/**
 * Cálculo de la prorrata del IVA.
 *
 * Prorrata general:
 *   % deducible = (Operaciones con derecho a deducir / Total de operaciones) × 100
 *   Redondeada al entero superior.
 *
 * Prorrata especial: cada cuota soportada se imputa según destino real.
 *   Solo se calcula cuando la diferencia con prorrata general > 10 puntos.
 */

export type ProrrataInput = {
  operaciones_con_derecho: number;        // entregas/servicios que dan derecho a deducir
  operaciones_sin_derecho: number;        // exentas que no dan derecho
  iva_soportado_total: number;
  iva_soportado_uso_exclusivo_con_derecho?: number;
  iva_soportado_uso_exclusivo_sin_derecho?: number;
  iva_soportado_uso_mixto?: number;
};

export type ProrrataResult = {
  pct_general: number;
  iva_deducible_general: number;
  pct_especial: number | null;
  iva_deducible_especial: number | null;
  diferencia_pct: number | null;
  recomendado: "general" | "especial";
  warnings: string[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcularProrrata(input: ProrrataInput): ProrrataResult {
  const warnings: string[] = [];
  const conDerecho = Number(input.operaciones_con_derecho ?? 0);
  const sinDerecho = Number(input.operaciones_sin_derecho ?? 0);
  const totalOps = conDerecho + sinDerecho;

  if (totalOps === 0) {
    return {
      pct_general: 0,
      iva_deducible_general: 0,
      pct_especial: null,
      iva_deducible_especial: null,
      diferencia_pct: null,
      recomendado: "general",
      warnings: ["Sin operaciones para calcular prorrata."],
    };
  }

  const pctGeneral = Math.ceil((conDerecho / totalOps) * 100);
  const ivaTotal = Number(input.iva_soportado_total ?? 0);
  const deducibleGeneral = round2((ivaTotal * pctGeneral) / 100);

  // Prorrata especial
  const exclusivoSi = Number(input.iva_soportado_uso_exclusivo_con_derecho ?? 0);
  const exclusivoNo = Number(input.iva_soportado_uso_exclusivo_sin_derecho ?? 0);
  const mixto = Number(input.iva_soportado_uso_mixto ?? 0);
  let pctEspecial: number | null = null;
  let deducibleEspecial: number | null = null;
  if (exclusivoSi > 0 || exclusivoNo > 0 || mixto > 0) {
    const deducibleEsp = exclusivoSi + (mixto * pctGeneral) / 100;
    deducibleEspecial = round2(deducibleEsp);
    pctEspecial = ivaTotal > 0 ? round2((deducibleEsp / ivaTotal) * 100) : 0;
  }

  const diferencia = pctEspecial != null ? Math.abs(pctGeneral - pctEspecial) : null;
  if (diferencia != null && diferencia > 10) {
    warnings.push(`Diferencia entre prorrata general y especial superior a 10 puntos (${diferencia.toFixed(0)} pp). Aplica obligatoriamente la especial.`);
  }

  return {
    pct_general: pctGeneral,
    iva_deducible_general: deducibleGeneral,
    pct_especial: pctEspecial,
    iva_deducible_especial: deducibleEspecial,
    diferencia_pct: diferencia,
    recomendado: diferencia != null && diferencia > 10 ? "especial" : "general",
    warnings,
  };
}

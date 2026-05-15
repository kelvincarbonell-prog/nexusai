/**
 * Modelo 200 — Impuesto sobre Sociedades. Anual, presentación: julio del año siguiente.
 *
 * Flujo de cálculo (PGC + LIS):
 *   1. Resultado contable (del P&G del ejercicio).
 *   2. ± Ajustes extracontables permanentes (gastos no deducibles, etc.).
 *   3. ± Ajustes extracontables temporales (diferencias temporarias).
 *   4. − Compensación BIN (Bases Imponibles Negativas) ejercicios anteriores
 *      (limitada al 70 % de la BI previa, mínimo 1 M € absorbible).
 *   5. = Base imponible.
 *   6. × Tipo gravamen (25 % general, 15 % nueva creación primer ejercicio con
 *      beneficios + el siguiente, 23 % pymes con cifra neta de negocios < 1 M).
 *   7. = Cuota íntegra.
 *   8. − Deducciones (I+D+i, doble imposición internacional, donativos, etc.).
 *   9. = Cuota líquida positiva.
 *  10. − Retenciones e ingresos a cuenta soportados.
 *  11. − Pagos fraccionados a cuenta (modelo 202).
 *  12. = Cuota líquida diferencial = a ingresar / a devolver.
 */

export type TipoGravamen = "general" | "nueva_creacion" | "pyme" | "otro";

export type Modelo200Input = {
  resultado_contable?: number;           // P&G del año (autocomputable)
  ajuste_aumento_permanente?: number;
  ajuste_disminucion_permanente?: number;
  ajuste_aumento_temporal?: number;
  ajuste_disminucion_temporal?: number;
  compensacion_bin?: number;             // BIN compensada del ejercicio
  bin_disponible?: number;               // BIN total acumulada disponible
  tipo_gravamen?: TipoGravamen;
  tipo_gravamen_custom?: number;         // si tipo === 'otro'
  deduccion_id_i?: number;
  deduccion_doble_imposicion?: number;
  deduccion_donativos?: number;
  deduccion_otras?: number;
  retenciones_soportadas?: number;
  pagos_fraccionados?: number;            // suma de modelos 202 del año
  cifra_negocios?: number;                // para detectar régimen pyme
};

export type Casillas200 = {
  c500: number;        // Resultado contable
  c401: number;        // Aumentos perm.
  c402: number;        // Disminuciones perm.
  c411: number;        // Aumentos temp.
  c412: number;        // Disminuciones temp.
  c545: number;        // BI antes de BIN
  c547: number;        // BIN aplicada
  c552: number;        // BI tras BIN
  c558: number;        // Tipo gravamen %
  c562: number;        // Cuota íntegra
  c565: number;        // Deducciones totales
  c592: number;        // Cuota líquida positiva
  c595: number;        // Retenciones e ingresos a cuenta
  c596: number;        // Pagos fraccionados (M202)
  c599: number;        // Resultado a ingresar / devolver
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const max0 = (n: number) => Math.max(0, n);

function tipoGravamenPct(input: Modelo200Input): number {
  if (input.tipo_gravamen === "otro") return Number(input.tipo_gravamen_custom ?? 25);
  if (input.tipo_gravamen === "nueva_creacion") return 15;
  if (input.tipo_gravamen === "pyme") return 23;
  return 25;
}

export function calcular200(input: Modelo200Input): {
  casillas: Casillas200;
  warnings: string[];
  resumen: { regimen: TipoGravamen; cifra_negocios?: number };
} {
  const warnings: string[] = [];

  const resultadoContable = Number(input.resultado_contable ?? 0);
  const aumentoPerm = Number(input.ajuste_aumento_permanente ?? 0);
  const dismPerm = Number(input.ajuste_disminucion_permanente ?? 0);
  const aumentoTemp = Number(input.ajuste_aumento_temporal ?? 0);
  const dismTemp = Number(input.ajuste_disminucion_temporal ?? 0);

  const biAntesBin = resultadoContable + aumentoPerm - dismPerm + aumentoTemp - dismTemp;

  // Compensación BIN — limitada al 70 % de la BI positiva (LIS art. 26)
  // con mínimo absorbible de 1 millón € independientemente del límite.
  const binDisponible = Number(input.bin_disponible ?? input.compensacion_bin ?? 0);
  let binAplicada = 0;
  if (biAntesBin > 0 && binDisponible > 0) {
    const limiteRelativo = biAntesBin * 0.7;
    const limite = Math.max(1_000_000, limiteRelativo);
    binAplicada = Math.min(binDisponible, limite, biAntesBin);
    if (input.compensacion_bin != null && input.compensacion_bin <= binDisponible) {
      binAplicada = Math.min(input.compensacion_bin, binAplicada);
    }
  }

  const baseImponible = round2(biAntesBin - binAplicada);

  const cifraNegocios = input.cifra_negocios;
  let regimen: TipoGravamen = input.tipo_gravamen ?? "general";
  if (!input.tipo_gravamen && cifraNegocios != null && cifraNegocios < 1_000_000) {
    regimen = "pyme";
    warnings.push("Detectado régimen pyme (cifra de negocios < 1 M €). Aplicando tipo reducido 23 %.");
  }
  const pct = tipoGravamenPct({ ...input, tipo_gravamen: regimen });
  const cuotaIntegra = max0(round2(baseImponible * (pct / 100)));

  const dedTotal = round2(
    Number(input.deduccion_id_i ?? 0) +
    Number(input.deduccion_doble_imposicion ?? 0) +
    Number(input.deduccion_donativos ?? 0) +
    Number(input.deduccion_otras ?? 0),
  );

  const cuotaLiquida = max0(round2(cuotaIntegra - dedTotal));
  const retenciones = Number(input.retenciones_soportadas ?? 0);
  const pagosFracc = Number(input.pagos_fraccionados ?? 0);
  const resultado = round2(cuotaLiquida - retenciones - pagosFracc);

  if (baseImponible < 0) {
    warnings.push("Base imponible negativa: este ejercicio genera BIN que podrás compensar en ejercicios futuros.");
  }
  if (cuotaIntegra > 0 && dedTotal > cuotaIntegra) {
    warnings.push("Las deducciones superan la cuota íntegra. El exceso queda pendiente de aplicar en ejercicios futuros (según tipo de deducción).");
  }

  return {
    casillas: {
      c500: round2(resultadoContable),
      c401: round2(aumentoPerm),
      c402: round2(dismPerm),
      c411: round2(aumentoTemp),
      c412: round2(dismTemp),
      c545: round2(biAntesBin),
      c547: round2(binAplicada),
      c552: baseImponible,
      c558: pct,
      c562: cuotaIntegra,
      c565: dedTotal,
      c592: cuotaLiquida,
      c595: round2(retenciones),
      c596: round2(pagosFracc),
      c599: resultado,
    },
    warnings,
    resumen: { regimen, cifra_negocios: cifraNegocios },
  };
}

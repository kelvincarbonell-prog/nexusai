/**
 * Modelo 202 — Pago fraccionado del Impuesto sobre Sociedades.
 * Trimestral (1P, 2P, 3P). Periodos: 1-20 abril, 1-20 octubre, 1-20 diciembre.
 *
 * Dos modalidades de cálculo:
 *  - Modalidad A (art. 40.2 LIS): cuota del último IS ya presentado × 18 %.
 *    Aplicable a empresas con cifra de negocios < 6 M €.
 *  - Modalidad B (art. 40.3 LIS): base imponible del periodo × tipo (17 % gen.
 *    o 24 % para grandes empresas). Obligatoria para INCN ≥ 6 M €.
 */

export type Modelo202Input = {
  modalidad: "A" | "B";
  periodo: "1P" | "2P" | "3P";
  // Modalidad A
  cuota_is_ejercicio_anterior?: number;     // casilla 599 del 200 del año anterior
  // Modalidad B
  base_imponible_acumulada?: number;          // BI desde inicio ejercicio hasta fin periodo
  retenciones_acumuladas?: number;
  pagos_fraccionados_anteriores?: number;     // 1P + 2P si estamos en 3P
  cifra_negocios?: number;                     // para tipo aplicable
};

export type Casillas202 = {
  c01: number;       // base de cálculo (cuota anterior o BI acumulada)
  c03: number;       // porcentaje aplicable (%)
  c04: number;       // resultado del cálculo
  c10: number;       // retenciones soportadas
  c12: number;       // pagos fraccionados anteriores
  c14: number;       // resultado a ingresar
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const max0 = (n: number) => Math.max(0, n);

export function calcular202(input: Modelo202Input): {
  casillas: Casillas202;
  warnings: string[];
  modalidad: "A" | "B";
} {
  const warnings: string[] = [];

  if (input.modalidad === "A") {
    const baseAnterior = Number(input.cuota_is_ejercicio_anterior ?? 0);
    const tipoA = 18;
    const cuotaAPagar = round2((baseAnterior * tipoA) / 100);
    if (baseAnterior <= 0) {
      warnings.push("La cuota del IS del ejercicio anterior es 0. En modalidad A no procede pago fraccionado.");
    }
    return {
      casillas: {
        c01: round2(baseAnterior),
        c03: tipoA,
        c04: cuotaAPagar,
        c10: 0,
        c12: 0,
        c14: cuotaAPagar,
      },
      warnings,
      modalidad: "A",
    };
  }

  // Modalidad B
  const bi = Number(input.base_imponible_acumulada ?? 0);
  const cifra = Number(input.cifra_negocios ?? 0);
  const esGrande = cifra >= 10_000_000;
  const tipoB = esGrande ? 24 : 17;
  const cuotaB = max0(round2((bi * tipoB) / 100));
  const retenciones = Number(input.retenciones_acumuladas ?? 0);
  const pagosAnt = Number(input.pagos_fraccionados_anteriores ?? 0);
  const resultado = round2(cuotaB - retenciones - pagosAnt);

  if (esGrande) {
    warnings.push("Cifra de negocios ≥ 10 M €. Tipo aplicable 24 % (gran empresa).");
  }

  return {
    casillas: {
      c01: round2(bi),
      c03: tipoB,
      c04: cuotaB,
      c10: round2(retenciones),
      c12: round2(pagosAnt),
      c14: resultado,
    },
    warnings,
    modalidad: "B",
  };
}

/**
 * Modelo 100 — Declaración del IRPF anual (particulares y autónomos).
 * Presentación: abril–junio del año siguiente al ejercicio.
 *
 * Estructura simplificada (MVP):
 *   - Rendimientos del trabajo (sueldos)
 *   - Rendimientos del capital mobiliario (intereses, dividendos)
 *   - Rendimientos del capital inmobiliario (alquileres cobrados)
 *   - Rendimientos de actividades económicas (autónomos)
 *   - Ganancias y pérdidas patrimoniales
 *   - Mínimo personal y familiar
 *   - Cuota íntegra estatal y autonómica
 *   - Deducciones (donativos, vivienda, autonómicas)
 *   - Retenciones e ingresos a cuenta soportados
 *   - Pagos fraccionados (M130/131)
 *   - Resultado: a pagar / a devolver
 */

export type Modelo100Input = {
  rend_trabajo: number;
  rend_capital_mobiliario?: number;
  rend_capital_inmobiliario?: number;
  rend_actividades_economicas?: number;
  ganancias_patrimoniales?: number;
  cuotas_ss_autonomo?: number;
  hijos_a_cargo?: number;
  edad?: number;
  comunidad_autonoma?: string;
  retenciones_trabajo?: number;
  retenciones_actividades?: number;
  pagos_fraccionados_m130?: number;
  deduccion_vivienda?: number;
  deduccion_donativos?: number;
  deduccion_autonomica?: number;
};

export type Casillas100 = {
  c0500: number;     // rendimientos trabajo netos
  c0030: number;     // rendimientos capital mobiliario
  c0085: number;     // rendimientos capital inmobiliario
  c0220: number;     // rendimientos actividades
  c0400: number;     // ganancias/pérdidas
  c0435: number;     // base imponible general
  c0455: number;     // base imponible ahorro
  c0505: number;     // mínimo personal y familiar
  c0510: number;     // base liquidable general
  c0520: number;     // cuota íntegra estatal
  c0530: number;     // cuota íntegra autonómica
  c0545: number;     // cuota líquida
  c0595: number;     // deducciones totales
  c0610: number;     // cuota diferencial
  c0625: number;     // retenciones y pagos a cuenta
  c0670: number;     // resultado liquidación
};

const round2 = (n: number) => Math.round(n * 100) / 100;

// Tabla IRPF estatal 2026 (mitad de la escala total, la otra mitad es autonómica)
const ESTATAL_BRACKETS = [
  { max: 12450, pct: 9.5 },
  { max: 20200, pct: 12 },
  { max: 35200, pct: 15 },
  { max: 60000, pct: 18.5 },
  { max: 300000, pct: 22.5 },
  { max: Infinity, pct: 24.5 },
];

// Tabla autonómica genérica (varía por CCAA, esta es la media)
const AUTONOMICA_BRACKETS = [
  { max: 12450, pct: 9.5 },
  { max: 20200, pct: 12 },
  { max: 35200, pct: 15 },
  { max: 60000, pct: 18.5 },
  { max: 300000, pct: 22.5 },
  { max: Infinity, pct: 22.5 },
];

// Tabla ahorro 2026
const AHORRO_BRACKETS = [
  { max: 6000, pct: 19 },
  { max: 50000, pct: 21 },
  { max: 200000, pct: 23 },
  { max: 300000, pct: 27 },
  { max: Infinity, pct: 30 },
];

function aplicaEscala(base: number, brackets: { max: number; pct: number }[]): number {
  if (base <= 0) return 0;
  let cuota = 0;
  let prev = 0;
  for (const b of brackets) {
    if (base > b.max) {
      cuota += (b.max - prev) * (b.pct / 100);
      prev = b.max;
    } else {
      cuota += (base - prev) * (b.pct / 100);
      break;
    }
  }
  return cuota;
}

function minimoPersonal(input: Modelo100Input): number {
  let min = 5550;
  const edad = input.edad ?? 30;
  if (edad >= 65) min += 1150;
  if (edad >= 75) min += 1400;
  const hijos = input.hijos_a_cargo ?? 0;
  if (hijos >= 1) min += 2400;
  if (hijos >= 2) min += 2700;
  if (hijos >= 3) min += 4000;
  if (hijos >= 4) min += 4500 * (hijos - 3);
  return min;
}

export function calcular100(input: Modelo100Input): {
  casillas: Casillas100;
  warnings: string[];
  resumen: { ccaa: string; resultado: "ingresar" | "devolver" | "cero" };
} {
  const warnings: string[] = [];
  const rt = Number(input.rend_trabajo ?? 0);
  const rcm = Number(input.rend_capital_mobiliario ?? 0);
  const rci = Number(input.rend_capital_inmobiliario ?? 0);
  const rae = Number(input.rend_actividades_economicas ?? 0);
  const gan = Number(input.ganancias_patrimoniales ?? 0);
  const cuotasSS = Number(input.cuotas_ss_autonomo ?? 0);

  // Reducción rendimientos trabajo: 2000 €
  const rtNeto = Math.max(0, rt - 2000);
  // Reducción autónomos: cuotas SS
  const raeNeto = rae - cuotasSS;

  const baseGeneral = rtNeto + rci + raeNeto;
  const baseAhorro = rcm + gan;

  const min = minimoPersonal(input);
  const baseLiquidableGeneral = Math.max(0, baseGeneral - min);

  // Cuota íntegra
  const cuotaEstatal = aplicaEscala(baseLiquidableGeneral, ESTATAL_BRACKETS);
  const cuotaAutonomica = aplicaEscala(baseLiquidableGeneral, AUTONOMICA_BRACKETS);
  const cuotaAhorro = aplicaEscala(baseAhorro, AHORRO_BRACKETS);
  const cuotaIntegra = cuotaEstatal + cuotaAutonomica + cuotaAhorro;

  // Deducciones (aplican sobre cuota)
  const deducciones = Number(input.deduccion_vivienda ?? 0) +
    Number(input.deduccion_donativos ?? 0) +
    Number(input.deduccion_autonomica ?? 0);

  const cuotaLiquida = Math.max(0, cuotaIntegra - deducciones);

  // Retenciones y pagos
  const retenciones = Number(input.retenciones_trabajo ?? 0) + Number(input.retenciones_actividades ?? 0);
  const pagosFracc = Number(input.pagos_fraccionados_m130 ?? 0);

  const resultado = round2(cuotaLiquida - retenciones - pagosFracc);

  if (baseLiquidableGeneral === 0 && baseAhorro === 0) {
    warnings.push("La base liquidable es 0. Comprueba que has introducido los rendimientos correctamente.");
  }

  return {
    casillas: {
      c0500: round2(rtNeto),
      c0030: round2(rcm),
      c0085: round2(rci),
      c0220: round2(raeNeto),
      c0400: round2(gan),
      c0435: round2(baseGeneral),
      c0455: round2(baseAhorro),
      c0505: round2(min),
      c0510: round2(baseLiquidableGeneral),
      c0520: round2(cuotaEstatal),
      c0530: round2(cuotaAutonomica),
      c0545: round2(cuotaLiquida),
      c0595: round2(deducciones),
      c0610: round2(cuotaLiquida),
      c0625: round2(retenciones + pagosFracc),
      c0670: resultado,
    },
    warnings,
    resumen: {
      ccaa: input.comunidad_autonoma ?? "Régimen común",
      resultado: resultado > 0 ? "ingresar" : resultado < 0 ? "devolver" : "cero",
    },
  };
}

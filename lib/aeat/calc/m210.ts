/**
 * Modelo 210 — IRPF / IS no residentes (sin establecimiento permanente).
 * Por cada renta obtenida en España. Tipos típicos:
 *   - 19 % residentes UE/EEE
 *   - 24 % resto países
 *   - 19 % dividendos/intereses/ganancias patrimoniales
 *   - 24 % rendimientos del trabajo
 *
 * Posibles gastos deducibles según residencia UE/EEE.
 */

export type Modelo210Input = {
  pais_residencia?: string;
  es_residente_ue_eee?: boolean;
  tipo_renta: "trabajo" | "actividades" | "dividendos" | "intereses" | "ganancias_patrimoniales" | "inmuebles" | "otros";
  ingresos_brutos: number;
  gastos_deducibles?: number;             // solo si UE/EEE
  retenciones_practicadas?: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export type Casillas210 = {
  c01: number;     // ingresos brutos
  c02: number;     // gastos deducibles (si UE/EEE)
  c03: number;     // base imponible
  c04: number;     // tipo gravamen
  c05: number;     // cuota íntegra
  c06: number;     // retenciones soportadas
  c07: number;     // resultado a ingresar
};

function tipoGravamen(input: Modelo210Input): number {
  const ue = input.es_residente_ue_eee !== false;
  if (input.tipo_renta === "trabajo") return ue ? 19 : 24;
  if (input.tipo_renta === "dividendos" || input.tipo_renta === "intereses" || input.tipo_renta === "ganancias_patrimoniales") return 19;
  return ue ? 19 : 24;
}

export function calcular210(input: Modelo210Input) {
  const ingresos = Number(input.ingresos_brutos ?? 0);
  const ue = input.es_residente_ue_eee !== false;
  const gastosDed = ue ? Number(input.gastos_deducibles ?? 0) : 0;
  const base = Math.max(0, ingresos - gastosDed);
  const pct = tipoGravamen(input);
  const cuota = round2((base * pct) / 100);
  const retenciones = Number(input.retenciones_practicadas ?? 0);
  const resultado = round2(cuota - retenciones);

  const warnings: string[] = [];
  if (!ue && input.gastos_deducibles) {
    warnings.push("Los no residentes fuera de UE/EEE NO pueden deducir gastos. Aplicando solo sobre ingresos brutos.");
  }
  return {
    casillas: { c01: round2(ingresos), c02: round2(gastosDed), c03: round2(base), c04: pct, c05: cuota, c06: round2(retenciones), c07: resultado } as Casillas210,
    warnings,
    resumen: { pais: input.pais_residencia, ue, tipo: input.tipo_renta },
  };
}

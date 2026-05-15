/**
 * Modelo 130 — Pago fraccionado del IRPF. Estimación directa.
 * Cálculo acumulado del año natural hasta el final del trimestre presentado.
 * Tipo aplicable: 20 % sobre rendimientos netos.
 */

export type FacturaInput = {
  id: string;
  tipo: "emitida" | "recibida" | "simplificada";
  base: number;
  irpf?: number;
  fecha_emision: string | null;
};

export type GastoInput = {
  id: string;
  base: number;
  fecha: string | null;
};

export type Casillas130 = {
  c01: number; // ingresos computables del periodo (acumulado)
  c02: number; // gastos deducibles (acumulado)
  c03: number; // rendimiento neto (01-02)
  c04: number; // 20% sobre 03
  c05: number; // retenciones soportadas (acumulado)
  c06: number; // pagos fraccionados anteriores en el ejercicio
  c07: number; // resultado anterior negativo (compensación)
  c12: number; // diferencia (04-05-06-07)
  c13: number; // deducción art. 110.3 LIRPF (rendimientos bajos) — manual
  c14: number; // a deducir por pagos fraccionados periodos anteriores
  c15: number; // a deducir por pagos a otros estados (sin uso MVP)
  c19: number; // resultado liquidación = 12 - 13 - 14
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const TIPO_DEFAULT = 20;

export function calcular130(input: {
  facturas: FacturaInput[];
  gastos: GastoInput[];
  pagosFraccionadosAnteriores?: number;
}): { casillas: Casillas130; warnings: string[]; resumen: { ingresos: number; gastos: number } } {
  const c: Casillas130 = {
    c01: 0, c02: 0, c03: 0, c04: 0, c05: 0,
    c06: input.pagosFraccionadosAnteriores ?? 0,
    c07: 0, c12: 0, c13: 0, c14: 0, c15: 0, c19: 0,
  };
  const warnings: string[] = [];

  let countIng = 0;
  let countGastos = 0;

  for (const f of input.facturas) {
    if (f.tipo === "emitida" || f.tipo === "simplificada") {
      countIng++;
      c.c01 += Number(f.base ?? 0);
    } else if (f.tipo === "recibida") {
      // las recibidas no van aquí; gastos van en `gastos`
    }
    if (f.irpf) c.c05 += Number(f.irpf);
  }
  for (const g of input.gastos) {
    countGastos++;
    c.c02 += Number(g.base ?? 0);
  }

  c.c03 = c.c01 - c.c02;
  c.c04 = round2((c.c03 * TIPO_DEFAULT) / 100);
  c.c12 = round2(c.c04 - c.c05 - c.c06 - c.c07);
  c.c19 = round2(c.c12 - c.c13 - c.c14 - c.c15);

  for (const k of Object.keys(c) as (keyof Casillas130)[]) c[k] = round2(c[k] as number);

  if (c.c19 < 0) {
    warnings.push("Resultado negativo: este trimestre no toca pagar. Se acumula a compensar.");
  }

  return { casillas: c, warnings, resumen: { ingresos: countIng, gastos: countGastos } };
}

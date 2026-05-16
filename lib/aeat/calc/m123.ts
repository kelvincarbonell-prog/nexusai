/**
 * Modelo 123 — Retenciones e ingresos a cuenta sobre rendimientos
 * del capital mobiliario (dividendos, intereses, etc.). Trimestral.
 * Tipo general 19 %.
 */

export type RentaCapital = {
  perceptor_nif: string;
  perceptor_nombre: string;
  base: number;
  retencion_pct?: number;
};

export type Casillas123 = {
  c01: number;     // nº perceptores
  c02: number;     // base total
  c03: number;     // retenciones total (19 %)
  c28: number;     // total a ingresar
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcular123(input: { rentas: RentaCapital[] }) {
  const set = new Set<string>();
  let base = 0;
  let ret = 0;
  for (const r of input.rentas) {
    set.add(r.perceptor_nif);
    const b = Number(r.base ?? 0);
    const pct = Number(r.retencion_pct ?? 19);
    base += b;
    ret += (b * pct) / 100;
  }
  return {
    casillas: {
      c01: set.size,
      c02: round2(base),
      c03: round2(ret),
      c28: round2(ret),
    } as Casillas123,
    warnings: [],
    resumen: { num_rentas: input.rentas.length },
  };
}

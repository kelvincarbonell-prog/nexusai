/**
 * Modelo 309 — Declaración liquidación no periódica de IVA.
 * Para sujetos pasivos no obligados a presentar 303 (operaciones puntuales).
 * Trimestral / por evento.
 */

export type Modelo309Input = {
  base_imponible: number;
  iva_pct: number;
  retenciones_aplicadas?: number;
};

export type Casillas309 = {
  c01: number;     // base imponible
  c02: number;     // tipo
  c03: number;     // cuota
  c04: number;     // retenciones
  c05: number;     // resultado a ingresar
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcular309(input: Modelo309Input) {
  const base = Number(input.base_imponible ?? 0);
  const pct = Number(input.iva_pct ?? 21);
  const cuota = round2((base * pct) / 100);
  const retenciones = Number(input.retenciones_aplicadas ?? 0);
  const resultado = round2(cuota - retenciones);
  return {
    casillas: {
      c01: round2(base),
      c02: pct,
      c03: cuota,
      c04: round2(retenciones),
      c05: resultado,
    } as Casillas309,
    warnings: resultado < 0 ? ["Resultado negativo: solicita devolución."] : [],
    resumen: { tipo_aplicado: pct },
  };
}

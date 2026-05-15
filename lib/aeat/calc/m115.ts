/**
 * Modelo 115 — Retenciones de arrendamientos de inmuebles urbanos.
 * Tipo de retención 2026: 19 %.
 * Origen: gastos con cuenta PGC 621 (arrendamientos) o metadata.es_alquiler.
 */

export type GastoAlquilerInput = {
  id: string;
  proveedor: string | null;
  base: number;
  fecha: string | null;
  metadata?: Record<string, unknown> | null;
};

export type Casillas115 = {
  c01: number; // num arrendadores
  c02: number; // base
  c03: number; // retenciones
  c28: number; // total a ingresar
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const RETENCION_DEFAULT = 19;

export function calcular115(input: { gastos: GastoAlquilerInput[] }): {
  casillas: Casillas115;
  warnings: string[];
  resumen: { arrendadores: number };
} {
  const c: Casillas115 = { c01: 0, c02: 0, c03: 0, c28: 0 };
  const warnings: string[] = [];

  const arrendadores = new Set<string>();
  for (const g of input.gastos) {
    const base = Number(g.base ?? 0);
    const pct = Number(g.metadata?.["retencion_pct"] ?? RETENCION_DEFAULT);
    const retenido = Math.round(base * pct) / 100;
    if (g.proveedor) arrendadores.add(g.proveedor.toLowerCase().trim());
    c.c02 += base;
    c.c03 += retenido;
    if (!g.proveedor) warnings.push(`Gasto ${g.id}: sin proveedor identificado.`);
  }
  c.c01 = arrendadores.size;
  c.c28 = round2(c.c03);
  for (const k of Object.keys(c) as (keyof Casillas115)[]) c[k] = round2(c[k] as number);
  return { casillas: c, warnings, resumen: { arrendadores: c.c01 } };
}

/**
 * Modelo 180 — Resumen anual de retenciones e ingresos a cuenta sobre
 * rendimientos procedentes del arrendamiento de inmuebles urbanos.
 * Agrega los 4 trimestres del 115.
 */

import type { Casillas115 } from "@/lib/aeat/calc/m115";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type Casillas180 = {
  c01: number;     // num arrendadores únicos (estimado del último trimestre)
  c02: number;     // base total anual
  c03: number;     // retenciones totales anuales
};

export type DeclaracionTrimestralLite = {
  modelo: string;
  ejercicio: number;
  periodo: string;
  status: string;
  casillas: Casillas115;
};

export function calcular180(input: { declaraciones115: DeclaracionTrimestralLite[] }): {
  casillas: Casillas180;
  warnings: string[];
  resumen: { trimestres_incluidos: string[]; trimestres_faltantes: string[] };
} {
  const c: Casillas180 = { c01: 0, c02: 0, c03: 0 };
  const incluidos: string[] = [];
  const todos = ["1T", "2T", "3T", "4T"];

  let maxArrendadores = 0;
  for (const t of todos) {
    const d = input.declaraciones115.find((x) => x.periodo === t);
    if (!d || d.status === "anulado") continue;
    incluidos.push(t);
    c.c02 += Number(d.casillas.c02 ?? 0);
    c.c03 += Number(d.casillas.c03 ?? 0);
    maxArrendadores = Math.max(maxArrendadores, Number(d.casillas.c01 ?? 0));
  }
  c.c01 = maxArrendadores;
  c.c02 = round2(c.c02);
  c.c03 = round2(c.c03);

  const faltantes = todos.filter((t) => !incluidos.includes(t));
  const warnings: string[] = [];
  if (faltantes.length > 0) {
    warnings.push(`Faltan los trimestres ${faltantes.join(", ")}. El 180 saldrá incompleto.`);
  }

  return { casillas: c, warnings, resumen: { trimestres_incluidos: incluidos, trimestres_faltantes: faltantes } };
}

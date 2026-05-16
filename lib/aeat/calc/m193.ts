/**
 * Modelo 193 — Resumen anual de retenciones e ingresos a cuenta
 * sobre rendimientos del capital mobiliario.
 * Agrega los 4 trimestres del 123.
 */

import type { Casillas123 } from "@/lib/aeat/calc/m123";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type Casillas193 = {
  num_perceptores: number;
  total_base: number;
  total_retenciones: number;
};

export type DeclTrim = { modelo: string; ejercicio: number; periodo: string; status: string; casillas: Casillas123 };

export function calcular193(input: { declaraciones123: DeclTrim[] }) {
  let perceptoresMax = 0;
  let base = 0;
  let ret = 0;
  const incluidos: string[] = [];
  for (const t of ["1T", "2T", "3T", "4T"]) {
    const d = input.declaraciones123.find((x) => x.periodo === t);
    if (!d || d.status === "anulado") continue;
    incluidos.push(t);
    perceptoresMax = Math.max(perceptoresMax, Number(d.casillas.c01 ?? 0));
    base += Number(d.casillas.c02 ?? 0);
    ret += Number(d.casillas.c03 ?? 0);
  }
  const faltantes = ["1T", "2T", "3T", "4T"].filter((t) => !incluidos.includes(t));
  return {
    casillas: { num_perceptores: perceptoresMax, total_base: round2(base), total_retenciones: round2(ret) } as Casillas193,
    warnings: faltantes.length > 0 ? [`Faltan los trimestres ${faltantes.join(", ")}.`] : [],
    resumen: { incluidos, faltantes },
  };
}

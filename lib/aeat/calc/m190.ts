/**
 * Modelo 190 — Resumen anual de retenciones e ingresos a cuenta del IRPF
 * sobre rendimientos del trabajo y actividades económicas.
 * Agrega los 4 trimestres del 111.
 */

import type { Casillas111 } from "@/lib/aeat/calc/m111";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type Casillas190 = {
  // Trabajo personal (clave A)
  c01: number; c02: number; c03: number;
  // Profesionales (clave G)
  c04: number; c05: number; c06: number;
  // Totales
  total_perceptores: number;
  total_base: number;
  total_retenciones: number;
};

export type DeclaracionTrimestralLite = {
  modelo: string;
  ejercicio: number;
  periodo: string;
  status: string;
  casillas: Casillas111;
};

export function calcular190(input: { declaraciones111: DeclaracionTrimestralLite[] }): {
  casillas: Casillas190;
  warnings: string[];
  resumen: { trimestres_incluidos: string[]; trimestres_faltantes: string[] };
} {
  const c: Casillas190 = {
    c01: 0, c02: 0, c03: 0, c04: 0, c05: 0, c06: 0,
    total_perceptores: 0, total_base: 0, total_retenciones: 0,
  };
  const incluidos: string[] = [];
  const todos = ["1T", "2T", "3T", "4T"];

  let maxTrabajadores = 0;
  let maxProfesionales = 0;
  for (const t of todos) {
    const d = input.declaraciones111.find((x) => x.periodo === t);
    if (!d || d.status === "anulado") continue;
    incluidos.push(t);
    c.c02 += Number(d.casillas.c02 ?? 0);
    c.c03 += Number(d.casillas.c03 ?? 0);
    c.c05 += Number(d.casillas.c05 ?? 0);
    c.c06 += Number(d.casillas.c06 ?? 0);
    maxTrabajadores = Math.max(maxTrabajadores, Number(d.casillas.c01 ?? 0));
    maxProfesionales = Math.max(maxProfesionales, Number(d.casillas.c04 ?? 0));
  }
  c.c01 = maxTrabajadores;
  c.c04 = maxProfesionales;
  c.total_perceptores = c.c01 + c.c04;
  c.total_base = round2(c.c02 + c.c05);
  c.total_retenciones = round2(c.c03 + c.c06);

  for (const k of Object.keys(c) as (keyof Casillas190)[]) {
    (c as unknown as Record<string, number>)[k] = round2((c as unknown as Record<string, number>)[k]);
  }

  const faltantes = todos.filter((t) => !incluidos.includes(t));
  const warnings: string[] = [];
  if (faltantes.length > 0) {
    warnings.push(`Faltan los trimestres ${faltantes.join(", ")}. El 190 saldrá incompleto.`);
  }

  return { casillas: c, warnings, resumen: { trimestres_incluidos: incluidos, trimestres_faltantes: faltantes } };
}

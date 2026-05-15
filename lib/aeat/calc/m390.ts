/**
 * Modelo 390 — Resumen anual de IVA (declaración informativa).
 * Se obtiene agregando las 4 declaraciones 303 del ejercicio.
 * Si algún trimestre no está cerrado, calcula la parte que tiene y avisa.
 */

import type { Casillas303 } from "@/lib/aeat/calc/m303";

const ZEROS = (): Casillas303 => ({
  c01: 0, c02: 0, c03: 0, c04: 0, c05: 0, c06: 0, c07: 0, c08: 0, c09: 0,
  c10: 0, c11: 0, c12: 0, c13: 0, c14: 0, c15: 0, c27: 0,
  c28: 0, c29: 0, c30: 0, c31: 0, c32: 0, c33: 0, c34: 0, c35: 0,
  c36: 0, c37: 0, c38: 0, c39: 0, c40: 0, c41: 0, c45: 0, c46: 0,
  c66: 0, c69: 0, c70: 0, c71: 0,
});

const round2 = (n: number) => Math.round(n * 100) / 100;

export type Casillas390 = Casillas303 & {
  // Anuales propios del 390 (subset)
  c80: number;   // total operaciones realizadas
  c95: number;   // % prorrata
  c97: number;   // total volumen operaciones
  c98: number;   // total operaciones interior
  c99: number;   // total exportaciones / intracomunitarias
  c662: number;  // total IVA devengado
  c663: number;  // total IVA deducible
  c664: number;  // resultado liquidación anual
};

export type DeclaracionTrimestral = {
  modelo: string;
  ejercicio: number;
  periodo: string;
  status: string;
  casillas: Casillas303;
};

export function calcular390(input: { declaraciones303: DeclaracionTrimestral[] }): {
  casillas: Casillas390;
  warnings: string[];
  resumen: { trimestres_incluidos: string[]; trimestres_faltantes: string[] };
} {
  const c: Casillas390 = {
    ...ZEROS(),
    c80: 0, c95: 0, c97: 0, c98: 0, c99: 0, c662: 0, c663: 0, c664: 0,
  };
  const warnings: string[] = [];
  const incluidos: string[] = [];
  const todos = ["1T", "2T", "3T", "4T"];

  for (const t of todos) {
    const d = input.declaraciones303.find((x) => x.periodo === t);
    if (!d) continue;
    if (d.status === "anulado") continue;
    incluidos.push(t);
    const k = d.casillas;
    // Suma casillas 303 estándar
    (Object.keys(c) as (keyof Casillas303)[]).forEach((key) => {
      if (key in k) (c as unknown as Record<string, number>)[key] += Number(k[key] ?? 0);
    });
  }

  const faltantes = todos.filter((t) => !incluidos.includes(t));
  if (faltantes.length > 0) {
    warnings.push(`Faltan los trimestres ${faltantes.join(", ")}. El 390 saldrá incompleto hasta que los presentes.`);
  }

  // Totales anuales propios del 390
  c.c662 = c.c27;
  c.c663 = c.c45;
  c.c664 = round2(c.c662 - c.c663);

  c.c98 = round2(c.c01 + c.c04 + c.c07);             // bases interiores
  c.c99 = round2(c.c10 + c.c12);                     // intracomunitarias + ISP
  c.c97 = round2(c.c98 + c.c99);
  c.c80 = c.c97;
  c.c95 = 100;                                       // sin prorrata por defecto

  for (const k of Object.keys(c) as (keyof Casillas390)[]) {
    (c as unknown as Record<string, number>)[k] = round2((c as unknown as Record<string, number>)[k]);
  }

  return { casillas: c, warnings, resumen: { trimestres_incluidos: incluidos, trimestres_faltantes: faltantes } };
}

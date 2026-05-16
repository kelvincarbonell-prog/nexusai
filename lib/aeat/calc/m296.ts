/**
 * Modelo 296 — Resumen anual de retenciones e ingresos a cuenta
 * sobre rentas obtenidas en España por no residentes.
 *
 * Agrega los 4 trimestres (declaraciones 216) o input manual.
 * MVP: agregación manual de perceptores.
 */

import type { Casillas210 } from "@/lib/aeat/calc/m210";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type Perceptor296 = {
  nombre: string;
  nif: string;
  pais: string;
  base: number;
  retencion: number;
};

export type Casillas296 = {
  num_perceptores: number;
  total_base: number;
  total_retenciones: number;
};

export function calcular296(input: { perceptores: Perceptor296[] }) {
  const c: Casillas296 = {
    num_perceptores: input.perceptores.length,
    total_base: round2(input.perceptores.reduce((s, p) => s + Number(p.base ?? 0), 0)),
    total_retenciones: round2(input.perceptores.reduce((s, p) => s + Number(p.retencion ?? 0), 0)),
  };
  return { casillas: c, warnings: [], resumen: { perceptores: input.perceptores } };
}

export type { Casillas210 };

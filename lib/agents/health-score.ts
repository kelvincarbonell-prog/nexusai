/**
 * Calcula un health score 0-100 a partir de las alertas del bot fiscal
 * y categoriza la empresa en: "al_dia" | "atencion" | "critico".
 *
 * Penalizaciones por alerta:
 *   danger  → 15 puntos
 *   warning → 6 puntos
 *   info    → 2 puntos
 *
 * Categorías:
 *   >= 85 → al_dia
 *   60-84 → atencion
 *   < 60  → critico
 */

import type { Alerta } from "@/lib/agents/bot-fiscal";

export type HealthCategoria = "al_dia" | "atencion" | "critico";

export function computeHealthScore(alertas: Alerta[]): { score: number; categoria: HealthCategoria } {
  let penal = 0;
  for (const a of alertas) {
    if (a.nivel === "danger") penal += 15;
    else if (a.nivel === "warning") penal += 6;
    else penal += 2;
  }
  const score = Math.max(0, Math.min(100, 100 - penal));
  const categoria: HealthCategoria = score >= 85 ? "al_dia" : score >= 60 ? "atencion" : "critico";
  return { score, categoria };
}

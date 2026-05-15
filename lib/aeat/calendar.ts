/**
 * Calendario fiscal AEAT 2026 — fechas límite de presentación.
 * Genera la lista de "próximas obligaciones" para una empresa.
 */

import { trimestreToRange, type Trimestre } from "@/lib/aeat/queries";

export type Obligacion = {
  modelo: "303" | "111" | "115" | "130" | "390" | "200";
  label: string;
  periodo: string;          // "1T" | "2T" | ... | "ANUAL"
  ejercicio: number;
  fecha_limite: string;      // YYYY-MM-DD
  dias_restantes: number;
  esta_presentada: boolean;
  recurrencia: "trimestral" | "mensual" | "anual";
  empresa_aplica: ("autonomo" | "empresa")[];
};

const PLAZOS_TRIMESTRAL = {
  "1T": { month: 4, day: 20 },
  "2T": { month: 7, day: 20 },
  "3T": { month: 10, day: 20 },
  "4T": { month: 1, day: 30 }, // del año siguiente
} as const;

const MODELOS_TRIMESTRALES: Array<{
  modelo: Obligacion["modelo"];
  label: string;
  aplica: ("autonomo" | "empresa")[];
}> = [
  { modelo: "303", label: "IVA trimestral", aplica: ["autonomo", "empresa"] },
  { modelo: "111", label: "Retenciones IRPF (trabajadores y profesionales)", aplica: ["autonomo", "empresa"] },
  { modelo: "115", label: "Retenciones alquileres", aplica: ["autonomo", "empresa"] },
  { modelo: "130", label: "Pago fraccionado IRPF (estimación directa)", aplica: ["autonomo"] },
];

function fechaLimiteTrimestre(year: number, t: Trimestre): string {
  const cfg = PLAZOS_TRIMESTRAL[t];
  const refYear = t === "4T" ? year + 1 : year;
  return `${refYear}-${String(cfg.month).padStart(2, "0")}-${String(cfg.day).padStart(2, "0")}`;
}

function diasRestantes(target: string, now = new Date()): number {
  const t = new Date(target + "T23:59:59");
  return Math.ceil((t.getTime() - now.getTime()) / 86_400_000);
}

export function buildCalendar(opts: {
  empresaTipo: "autonomo" | "empresa";
  presentadas: Array<{ modelo: string; ejercicio: number; periodo: string }>;
  horizonteDias?: number;
  now?: Date;
}): Obligacion[] {
  const now = opts.now ?? new Date();
  const horizonte = opts.horizonteDias ?? 60;
  const year = now.getUTCFullYear();
  const trimestres: Trimestre[] = ["1T", "2T", "3T", "4T"];

  const ya = new Set(opts.presentadas.map((p) => `${p.modelo}|${p.ejercicio}|${p.periodo}`));
  const out: Obligacion[] = [];

  for (const yr of [year, year - 1]) {
    for (const t of trimestres) {
      for (const m of MODELOS_TRIMESTRALES) {
        if (!m.aplica.includes(opts.empresaTipo)) continue;
        const fecha = fechaLimiteTrimestre(yr, t);
        const dr = diasRestantes(fecha, now);
        if (dr < -7) continue;       // ya pasaron hace más de una semana
        if (dr > horizonte) continue;
        const presentada = ya.has(`${m.modelo}|${yr}|${t}`);
        out.push({
          modelo: m.modelo,
          label: `${m.modelo} · ${m.label}`,
          periodo: t,
          ejercicio: yr,
          fecha_limite: fecha,
          dias_restantes: dr,
          esta_presentada: presentada,
          recurrencia: "trimestral",
          empresa_aplica: m.aplica,
        });
      }
    }
  }

  // Modelo 390 (anual IVA): enero del año siguiente
  for (const yr of [year - 1, year]) {
    const fecha = `${yr + 1}-01-30`;
    const dr = diasRestantes(fecha, now);
    if (dr < -7 || dr > horizonte) continue;
    out.push({
      modelo: "390",
      label: "390 · Resumen anual IVA",
      periodo: "ANUAL",
      ejercicio: yr,
      fecha_limite: fecha,
      dias_restantes: dr,
      esta_presentada: opts.presentadas.some((p) => p.modelo === "390" && p.ejercicio === yr),
      recurrencia: "anual",
      empresa_aplica: ["autonomo", "empresa"],
    });
  }

  return out.sort((a, b) => a.dias_restantes - b.dias_restantes);
}

export function urgencyClass(o: Obligacion): "good" | "warn" | "bad" {
  if (o.esta_presentada) return "good";
  if (o.dias_restantes < 0) return "bad";
  if (o.dias_restantes <= 7) return "bad";
  if (o.dias_restantes <= 21) return "warn";
  return "good";
}

// Re-export para no tener dependencia circular
export type { Trimestre };
export { trimestreToRange };

/**
 * Calendario fiscal AEAT 2026 — fechas límite de presentación.
 * Genera la lista de "próximas obligaciones" para una empresa.
 */

import { trimestreToRange, type Trimestre } from "@/lib/aeat/queries";

export type Obligacion = {
  modelo: "303" | "111" | "115" | "123" | "130" | "180" | "184" | "190" | "193" | "200" | "202" | "210" | "232" | "296" | "309" | "347" | "349" | "390" | "720" | "100";
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
  { modelo: "123", label: "Retenciones capital mobiliario", aplica: ["autonomo", "empresa"] },
  { modelo: "130", label: "Pago fraccionado IRPF (estimación directa)", aplica: ["autonomo"] },
  { modelo: "349", label: "Operaciones intracomunitarias", aplica: ["autonomo", "empresa"] },
  { modelo: "309", label: "IVA no periódica", aplica: ["autonomo", "empresa"] },
];

// Modelo 202: pagos fraccionados IS — solo empresa, en abril, octubre y diciembre
const PLAZOS_M202: Array<{ month: number; day: number; periodo: "1P" | "2P" | "3P" }> = [
  { month: 4, day: 20, periodo: "1P" },
  { month: 10, day: 20, periodo: "2P" },
  { month: 12, day: 20, periodo: "3P" },
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

  // Modelos anuales: cada uno con su fecha límite y filtro autonomo/empresa
  const ANUALES: Array<{
    modelo: Obligacion["modelo"];
    label: string;
    fechaLimite: (yr: number) => string;
    aplica: ("autonomo" | "empresa")[];
  }> = [
    { modelo: "390", label: "390 · Resumen anual IVA", fechaLimite: (yr) => `${yr + 1}-01-30`, aplica: ["autonomo", "empresa"] },
    { modelo: "180", label: "180 · Resumen anual retenciones alquileres", fechaLimite: (yr) => `${yr + 1}-01-31`, aplica: ["autonomo", "empresa"] },
    { modelo: "190", label: "190 · Resumen anual retenciones IRPF", fechaLimite: (yr) => `${yr + 1}-01-31`, aplica: ["autonomo", "empresa"] },
    { modelo: "193", label: "193 · Resumen anual capital mobiliario", fechaLimite: (yr) => `${yr + 1}-01-31`, aplica: ["autonomo", "empresa"] },
    { modelo: "296", label: "296 · Resumen anual no residentes", fechaLimite: (yr) => `${yr + 1}-01-31`, aplica: ["autonomo", "empresa"] },
    { modelo: "347", label: "347 · Operaciones con terceros >3.005,06€", fechaLimite: (yr) => `${yr + 1}-02-28`, aplica: ["autonomo", "empresa"] },
    { modelo: "232", label: "232 · Operaciones vinculadas y paraísos fiscales", fechaLimite: (yr) => `${yr + 1}-11-30`, aplica: ["empresa"] },
    { modelo: "720", label: "720 · Bienes y derechos en el extranjero", fechaLimite: (yr) => `${yr + 1}-03-31`, aplica: ["autonomo", "empresa"] },
    { modelo: "100", label: "100 · Declaración de la Renta", fechaLimite: (yr) => `${yr + 1}-06-30`, aplica: ["autonomo"] },
    { modelo: "200", label: "200 · Impuesto sobre Sociedades", fechaLimite: (yr) => `${yr + 1}-07-25`, aplica: ["empresa"] },
    { modelo: "184", label: "184 · Atribución de rentas (CB/SC)", fechaLimite: (yr) => `${yr + 1}-02-28`, aplica: ["autonomo"] },
  ];
  for (const yr of [year - 1, year]) {
    for (const a of ANUALES) {
      if (!a.aplica.includes(opts.empresaTipo)) continue;
      const fecha = a.fechaLimite(yr);
      const dr = diasRestantes(fecha, now);
      if (dr < -7 || dr > horizonte) continue;
      out.push({
        modelo: a.modelo,
        label: a.label,
        periodo: "ANUAL",
        ejercicio: yr,
        fecha_limite: fecha,
        dias_restantes: dr,
        esta_presentada: opts.presentadas.some((p) => p.modelo === a.modelo && p.ejercicio === yr),
        recurrencia: "anual",
        empresa_aplica: a.aplica,
      });
    }
  }

  // Modelo 202 (3 pagos al año) — solo empresa
  if (opts.empresaTipo === "empresa") {
    for (const yr of [year, year - 1]) {
      for (const p of PLAZOS_M202) {
        const fecha = `${yr}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
        const dr = diasRestantes(fecha, now);
        if (dr < -7 || dr > horizonte) continue;
        out.push({
          modelo: "202",
          label: `202 · Pago fraccionado IS (${p.periodo})`,
          periodo: p.periodo,
          ejercicio: yr,
          fecha_limite: fecha,
          dias_restantes: dr,
          esta_presentada: opts.presentadas.some((pp) => pp.modelo === "202" && pp.ejercicio === yr && pp.periodo === p.periodo),
          recurrencia: "trimestral",
          empresa_aplica: ["empresa"],
        });
      }
    }
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

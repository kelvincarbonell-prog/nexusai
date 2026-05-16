/**
 * Calendario laboral España.
 * Festivos nacionales + festivos autonómicos comunes + cómputo de días
 * laborables por mes (excluye sábados, domingos y festivos).
 */

const FESTIVOS_NACIONALES_2026 = [
  "2026-01-01", // Año Nuevo
  "2026-01-06", // Reyes
  "2026-04-03", // Viernes Santo
  "2026-05-01", // Día del Trabajo
  "2026-08-15", // Asunción
  "2026-10-12", // Hispanidad
  "2026-11-01", // Todos los Santos
  "2026-12-06", // Constitución
  "2026-12-08", // Inmaculada
  "2026-12-25", // Navidad
];

const FESTIVOS_NACIONALES_2027 = [
  "2027-01-01",
  "2027-01-06",
  "2027-03-26",
  "2027-05-01",
  "2027-08-15",
  "2027-10-12",
  "2027-11-01",
  "2027-12-06",
  "2027-12-08",
  "2027-12-25",
];

const FESTIVOS_AUTONOMICOS_2026: Record<string, string[]> = {
  madrid: ["2026-05-02", "2026-05-15", "2026-11-09"],
  cataluna: ["2026-04-06", "2026-06-24", "2026-09-11", "2026-12-26"],
  valencia: ["2026-03-19", "2026-04-06", "2026-10-09"],
  andalucia: ["2026-02-28", "2026-04-02"],
  pais_vasco: ["2026-04-06", "2026-07-25"],
  galicia: ["2026-05-17", "2026-07-25"],
};

export function festivosDe(year: number, ccaa?: string): string[] {
  const base = year === 2027 ? FESTIVOS_NACIONALES_2027 : FESTIVOS_NACIONALES_2026;
  const auto = ccaa ? FESTIVOS_AUTONOMICOS_2026[ccaa.toLowerCase()] ?? [] : [];
  return [...base, ...auto];
}

export function esLaborable(fecha: string, festivos: string[]): boolean {
  const d = new Date(fecha + "T00:00:00");
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !festivos.includes(fecha);
}

export function diasLaborablesMes(year: number, month: number, ccaa?: string): number {
  const festivos = festivosDe(year, ccaa);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let d = 1; d <= last; d++) {
    const fecha = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (esLaborable(fecha, festivos)) count++;
  }
  return count;
}

export function diasLaborablesAno(year: number, ccaa?: string): number {
  let total = 0;
  for (let m = 1; m <= 12; m++) total += diasLaborablesMes(year, m, ccaa);
  return total;
}

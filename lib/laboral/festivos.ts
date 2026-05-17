/**
 * Calendario laboral España: festivos nacionales + autonómicos.
 *
 * Cubre los 9 festivos nacionales fijos + 5 trasladables del calendario
 * laboral estatal, más los más comunes por CCAA. Los festivos locales
 * (municipales) los configura cada empresa.
 *
 * Datos orientativos para 2026; la lista exacta se publica cada año en BOE.
 */

export type Festivo = {
  fecha: string;         // YYYY-MM-DD
  nombre: string;
  ambito: "nacional" | "ccaa" | "local";
  ccaa?: string;         // ISO ES-XX
};

const NACIONAL_FIJOS_2026: Array<{ md: string; nombre: string }> = [
  { md: "01-01", nombre: "Año Nuevo" },
  { md: "01-06", nombre: "Epifanía del Señor" },
  { md: "04-03", nombre: "Viernes Santo" },                    // 2026 Viernes Santo = 3 abr
  { md: "05-01", nombre: "Día del Trabajo" },
  { md: "08-15", nombre: "Asunción de la Virgen" },
  { md: "10-12", nombre: "Fiesta Nacional de España" },
  { md: "11-01", nombre: "Todos los Santos" },
  { md: "12-06", nombre: "Día de la Constitución" },
  { md: "12-08", nombre: "Inmaculada Concepción" },
  { md: "12-25", nombre: "Navidad" },
];

const CCAA_FIJOS_2026: Record<string, Array<{ md: string; nombre: string }>> = {
  "ES-AN": [
    { md: "02-28", nombre: "Día de Andalucía" },
  ],
  "ES-AR": [
    { md: "04-23", nombre: "Día de Aragón / San Jorge" },
  ],
  "ES-AS": [
    { md: "09-08", nombre: "Día de Asturias" },
  ],
  "ES-IB": [
    { md: "03-01", nombre: "Día de las Islas Baleares" },
  ],
  "ES-CN": [
    { md: "05-30", nombre: "Día de Canarias" },
  ],
  "ES-CB": [
    { md: "07-25", nombre: "Día de Cantabria" },
  ],
  "ES-CL": [
    { md: "04-23", nombre: "Día de Castilla y León" },
  ],
  "ES-CM": [
    { md: "05-31", nombre: "Día de Castilla-La Mancha" },
  ],
  "ES-CT": [
    { md: "09-11", nombre: "Diada Nacional de Cataluña" },
    { md: "06-24", nombre: "Sant Joan" },
  ],
  "ES-EX": [
    { md: "09-08", nombre: "Día de Extremadura" },
  ],
  "ES-GA": [
    { md: "07-25", nombre: "Día Nacional de Galicia" },
  ],
  "ES-MD": [
    { md: "05-02", nombre: "Día de la Comunidad de Madrid" },
  ],
  "ES-MC": [
    { md: "06-09", nombre: "Día de la Región de Murcia" },
  ],
  "ES-NC": [
    { md: "12-03", nombre: "San Francisco Javier (Navarra)" },
  ],
  "ES-PV": [
    { md: "10-25", nombre: "Día del País Vasco" },
  ],
  "ES-RI": [
    { md: "06-09", nombre: "Día de La Rioja" },
  ],
  "ES-VC": [
    { md: "10-09", nombre: "Día de la Comunitat Valenciana" },
  ],
};

export const CCAAS: Array<{ code: string; nombre: string }> = [
  { code: "ES-AN", nombre: "Andalucía" },
  { code: "ES-AR", nombre: "Aragón" },
  { code: "ES-AS", nombre: "Asturias" },
  { code: "ES-IB", nombre: "Islas Baleares" },
  { code: "ES-CN", nombre: "Canarias" },
  { code: "ES-CB", nombre: "Cantabria" },
  { code: "ES-CL", nombre: "Castilla y León" },
  { code: "ES-CM", nombre: "Castilla-La Mancha" },
  { code: "ES-CT", nombre: "Cataluña" },
  { code: "ES-EX", nombre: "Extremadura" },
  { code: "ES-GA", nombre: "Galicia" },
  { code: "ES-MD", nombre: "Madrid" },
  { code: "ES-MC", nombre: "Murcia" },
  { code: "ES-NC", nombre: "Navarra" },
  { code: "ES-PV", nombre: "País Vasco" },
  { code: "ES-RI", nombre: "La Rioja" },
  { code: "ES-VC", nombre: "Comunitat Valenciana" },
];

export function festivosAnyo(year: number, ccaa?: string): Festivo[] {
  const list: Festivo[] = [];
  for (const f of NACIONAL_FIJOS_2026) {
    list.push({ fecha: `${year}-${f.md}`, nombre: f.nombre, ambito: "nacional" });
  }
  if (ccaa && CCAA_FIJOS_2026[ccaa]) {
    for (const f of CCAA_FIJOS_2026[ccaa]) {
      list.push({ fecha: `${year}-${f.md}`, nombre: f.nombre, ambito: "ccaa", ccaa });
    }
  }
  // Ordena por fecha y deduplica
  return Array.from(new Map(list.map((x) => [x.fecha + x.nombre, x])).values()).sort((a, b) =>
    a.fecha < b.fecha ? -1 : 1,
  );
}

export function esLaborable(fechaISO: string, ccaa?: string): boolean {
  const d = new Date(fechaISO + "T00:00:00");
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  const year = d.getUTCFullYear();
  const fest = festivosAnyo(year, ccaa);
  return !fest.some((f) => f.fecha === fechaISO);
}

export function diasLaborables(from: string, to: string, ccaa?: string): number {
  const start = new Date(from + "T00:00:00").getTime();
  const end = new Date(to + "T00:00:00").getTime();
  let total = 0;
  for (let ts = start; ts <= end; ts += 86_400_000) {
    const iso = new Date(ts).toISOString().slice(0, 10);
    if (esLaborable(iso, ccaa)) total++;
  }
  return total;
}

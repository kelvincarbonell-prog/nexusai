/**
 * Tipos de cambio del Banco Central Europeo.
 * Endpoint público que devuelve los tipos diarios contra EUR.
 *
 * Cacheo en memoria del módulo durante 12 horas para evitar martillear
 * el BCE en cada request.
 */

const BCE_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

type Rates = { date: string; rates: Record<string, number> };

let cached: Rates | null = null;
let cachedAt = 0;

export async function fetchBceRates(): Promise<Rates> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
  const res = await fetch(BCE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`BCE ${res.status}`);
  const xml = await res.text();
  const date = /time="([^"]+)"/.exec(xml)?.[1] ?? new Date().toISOString().slice(0, 10);
  const rates: Record<string, number> = { EUR: 1 };
  const re = /currency="([^"]+)"\s+rate="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    rates[match[1]] = Number(match[2]);
  }
  cached = { date, rates };
  cachedAt = Date.now();
  return cached;
}

export async function convert(amount: number, from: string, to: string): Promise<{ amount: number; rate: number; date: string }> {
  const { rates, date } = await fetchBceRates();
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) throw new Error(`Divisa no soportada: ${!fromRate ? from : to}`);
  // Todos los tipos están vs EUR. Convertimos pasando por EUR.
  const inEur = amount / fromRate;
  const out = inEur * toRate;
  return { amount: Math.round(out * 100) / 100, rate: toRate / fromRate, date };
}

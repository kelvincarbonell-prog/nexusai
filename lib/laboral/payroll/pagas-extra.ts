/**
 * Cálculo de pagas extraordinarias y antigüedad / trienios.
 *
 * En España el modelo más común es 14 pagas (12 mensuales + paga de verano
 * + paga de Navidad). Algunos convenios suman una 3ª (paga de beneficios).
 *
 * Cada paga extra puede:
 *  - Pagarse en su mes (junio/diciembre) → "extra"
 *  - Prorratearse en las 12 nóminas → "prorrateada"
 *
 * Para el prorrateo: importe_paga / pagas_anuales_totales se suma al
 * salario bruto mensual.
 */

export type PagaExtraConfig = {
  /** Mes natural de devengo (6 = junio, 12 = diciembre). */
  mes: number;
  /** Si se paga en el mes (false) o se prorratea en las 12 mensuales (true). */
  prorrateada: boolean;
  /** Importe equivalente a 1 mensualidad por defecto. Si tiene valor distinto, se usa. */
  importe?: number;
};

export type AntiguedadConfig = {
  fecha_alta: string;        // YYYY-MM-DD
  importe_trienio_anual: number; // p. ej. 5% del salario base o cantidad fija anual
  /** Algunos convenios topan por número de trienios. */
  max_trienios?: number;
};

/**
 * Cuántos trienios tiene el trabajador a fecha dada.
 */
export function trieniosDevengados(fechaAltaISO: string, refISO = new Date().toISOString().slice(0, 10)): number {
  const alta = new Date(fechaAltaISO + "T00:00:00").getTime();
  const ref = new Date(refISO + "T00:00:00").getTime();
  const anyos = (ref - alta) / (365.25 * 86_400_000);
  return Math.max(0, Math.floor(anyos / 3));
}

export function complementoAntiguedadMensual(c: AntiguedadConfig, refISO = new Date().toISOString().slice(0, 10)): number {
  const trienios = Math.min(c.max_trienios ?? 99, trieniosDevengados(c.fecha_alta, refISO));
  const anual = trienios * c.importe_trienio_anual;
  return Math.round((anual / 12) * 100) / 100;
}

/**
 * Importe a sumar al bruto mensual por prorrateo de pagas extra.
 *
 *   prorrateo = suma(importes_de_pagas_extra) / (12 mensualidades)
 *
 * Si la paga NO está prorrateada, devuelve 0 (se paga directamente en su mes).
 */
export function prorrateoPagasExtra(brutoMensual: number, pagas: PagaExtraConfig[]): number {
  let suma = 0;
  for (const p of pagas) {
    if (!p.prorrateada) continue;
    suma += p.importe ?? brutoMensual;
  }
  return Math.round((suma / 12) * 100) / 100;
}

/**
 * ¿Toca paga extra este mes? Si sí, devuelve el importe a sumar a la nómina.
 * Si la paga está prorrateada NO se suma (ya está incluida cada mes).
 */
export function pagaExtraDelMes(brutoMensual: number, pagas: PagaExtraConfig[], mes: number): number {
  for (const p of pagas) {
    if (p.prorrateada) continue;
    if (p.mes === mes) return Math.round((p.importe ?? brutoMensual) * 100) / 100;
  }
  return 0;
}

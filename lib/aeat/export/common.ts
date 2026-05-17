/**
 * Utilidades para generar ficheros AEAT en formato texto posicional.
 * Compartido entre todos los modelos (303 ya existe, 111/115/130/etc. usan estas helpers).
 *
 * Especificación AEAT:
 *  - Importes: 15 posiciones, 2 decimales implícitos, padding con ceros.
 *    Ejemplo: 1.234,56 € → "000000000123456"
 *  - Importes con signo: 1 char (" " o "N") + 16 dígitos.
 *  - Textos: padding a la derecha con espacios, truncados al máximo.
 *  - Numéricos sin decimales: padding con ceros a la izquierda.
 *  - NIF: 9 caracteres exactos.
 */

export function padRight(s: string | null | undefined, len: number, fill = " "): string {
  const v = String(s ?? "");
  return v.slice(0, len).padEnd(len, fill);
}

export function padLeft(s: string | number | null | undefined, len: number, fill = "0"): string {
  const v = String(s ?? "");
  return v.slice(-len).padStart(len, fill);
}

/**
 * Importe sin signo, 15 posiciones, 2 decimales implícitos.
 */
export function impNum(value: number | null | undefined): string {
  const cents = Math.round(Number(value ?? 0) * 100);
  return padLeft(String(Math.abs(cents)), 15);
}

/**
 * Importe con signo, 1 char + 16 dígitos. " " positivo, "N" negativo.
 */
export function impSigned(value: number | null | undefined): string {
  const cents = Math.round(Number(value ?? 0) * 100);
  const sign = cents < 0 ? "N" : " ";
  return sign + padLeft(String(Math.abs(cents)), 16);
}

/**
 * Número entero, padding con ceros a la izquierda.
 */
export function intNum(value: number | string | null | undefined, len: number): string {
  return padLeft(String(value ?? 0), len);
}

/**
 * NIF AEAT: 9 caracteres exactos.
 */
export function nifAeat(nif: string | null | undefined): string {
  const v = String(nif ?? "").toUpperCase().replace(/\s|-/g, "");
  return padRight(v, 9);
}

/**
 * Convierte el periodo trimestre al código AEAT.
 *   "1T" → "1T",  "ANUAL" → "0A"
 */
export function periodoAeat(periodo: string): string {
  if (periodo === "ANUAL") return "0A";
  return periodo;
}

/**
 * Convierte fecha YYYY-MM-DD a DDMMYYYY (formato AEAT).
 */
export function fechaAeat(iso: string | null | undefined): string {
  if (!iso) return "00000000";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "00000000";
  return `${m[3]}${m[2]}${m[1]}`;
}

export type AeatHeader = {
  modelo: string;             // "111", "115", "130", "200", "347"…
  ejercicio: number;
  periodo: string;            // "1T".."4T" | "ANUAL"
  nif: string;
  nombre: string;              // razón social o apellidos+nombre
  telefono?: string;
};

/**
 * Cabecera estándar tipo 1 (común a casi todos los modelos).
 *   1 │ modelo (3) │ ejercicio (4) │ periodo (2) │ NIF (9) │ nombre (80) │ teléfono (9)
 */
export function cabeceraT1(h: AeatHeader): string {
  return (
    "1" +
    padRight(h.modelo, 3) +
    padLeft(String(h.ejercicio), 4) +
    padRight(periodoAeat(h.periodo), 2) +
    nifAeat(h.nif) +
    padRight(h.nombre, 80) +
    padRight(h.telefono ?? "", 9)
  );
}

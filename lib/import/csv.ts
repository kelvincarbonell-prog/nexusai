/**
 * Parser CSV sin dependencias externas (RFC-4180 simplificado).
 * Soporta comas dentro de comillas, doble comilla escapada, BOM UTF-8.
 */

export type CSVRow = Record<string, string>;

export function parseCSV(text: string, delimiter = ","): CSVRow[] {
  // Quita BOM si existe
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  // Detecta delimitador si no se especifica explícitamente y la primera línea tiene ; sin , entre comillas
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  if (delimiter === "," && firstLine.split(";").length > firstLine.split(",").length) {
    delimiter = ";";
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cell += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === delimiter) { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        rows.push(row); row = [];
      } else {
        cell += c;
      }
    }
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const data: CSVRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length === 1 && r[0] === "") continue;
    const obj: CSVRow = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (r[j] ?? "").trim();
    }
    data.push(obj);
  }
  return data;
}

/**
 * Devuelve un array de strings cell-safe para escribir CSV con coma.
 */
export function toCSV(rows: Array<Record<string, string | number | null | undefined>>, headers?: string[]): string {
  if (rows.length === 0) return "";
  const cols = headers ?? Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\r\n") + "\r\n";
}

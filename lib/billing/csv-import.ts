/**
 * Importador genérico CSV/Excel a facturas/gastos.
 * Detecta separador (coma o punto y coma), parsea encabezados y mapea
 * columnas conocidas con heurística.
 */

export type FilaCSV = Record<string, string>;
export type FacturaImport = {
  numero?: string;
  contacto_nombre: string;
  contacto_nif?: string;
  fecha_emision?: string;
  fecha_vencimiento?: string;
  base: number;
  iva: number;
  total: number;
  tipo: "emitida" | "recibida" | "simplificada";
};
export type GastoImport = {
  proveedor: string;
  concepto?: string;
  fecha?: string;
  base: number;
  iva: number;
  total: number;
};

const HEADERS_MAP: Record<string, string[]> = {
  numero: ["numero", "número", "num", "nº", "factura", "n.factura", "invoice"],
  contacto_nombre: ["cliente", "proveedor", "razon social", "razón social", "nombre", "contacto", "company"],
  contacto_nif: ["nif", "cif", "vat", "tax id", "dni"],
  fecha_emision: ["fecha", "fecha emisión", "fecha emision", "f.emision", "issue date", "date"],
  fecha_vencimiento: ["vencimiento", "fecha vencimiento", "due date"],
  base: ["base", "base imponible", "subtotal", "neto", "amount"],
  iva: ["iva", "vat", "impuesto", "tax"],
  total: ["total", "importe", "total factura", "amount due"],
  concepto: ["concepto", "descripcion", "descripción", "detalle"],
};

export function parseCsv(content: string): { headers: string[]; rows: FilaCSV[]; separator: string } {
  const text = content.replace(/^﻿/, "");
  // Detectar separador
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const sep = semicolons >= commas ? ";" : ",";

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [], separator: sep };

  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  const rows: FilaCSV[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const row: FilaCSV = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    rows.push(row);
  }
  return { headers, rows, separator: sep };
}

function findHeader(headers: string[], aliases: string[]): string | undefined {
  for (const h of headers) {
    if (aliases.some((a) => h === a || h.includes(a))) return h;
  }
  return undefined;
}

function parseNumberES(v: string | undefined): number {
  if (!v) return 0;
  // Convierte "1.234,56" -> 1234.56 o "1,234.56" -> 1234.56
  const clean = v.replace(/[€\s]/g, "").trim();
  if (clean.includes(",") && clean.includes(".")) {
    // Asumimos formato ES: . miles, , decimal
    return Number(clean.replace(/\./g, "").replace(",", "."));
  }
  if (clean.includes(",")) return Number(clean.replace(",", "."));
  return Number(clean) || 0;
}

function parseFechaES(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const m1 = /^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/.exec(v);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  const m2 = /^(\d{4})[\/\-.](\d{2})[\/\-.](\d{2})$/.exec(v);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  return undefined;
}

export function mapearFacturas(
  csv: { headers: string[]; rows: FilaCSV[] },
  tipo: "emitida" | "recibida" = "emitida",
): { facturas: FacturaImport[]; errores: { fila: number; motivo: string }[] } {
  const facturas: FacturaImport[] = [];
  const errores: { fila: number; motivo: string }[] = [];

  const hNumero = findHeader(csv.headers, HEADERS_MAP.numero);
  const hContacto = findHeader(csv.headers, HEADERS_MAP.contacto_nombre);
  const hNif = findHeader(csv.headers, HEADERS_MAP.contacto_nif);
  const hFecha = findHeader(csv.headers, HEADERS_MAP.fecha_emision);
  const hVenc = findHeader(csv.headers, HEADERS_MAP.fecha_vencimiento);
  const hBase = findHeader(csv.headers, HEADERS_MAP.base);
  const hIva = findHeader(csv.headers, HEADERS_MAP.iva);
  const hTotal = findHeader(csv.headers, HEADERS_MAP.total);

  csv.rows.forEach((row, i) => {
    const contacto = hContacto ? row[hContacto] : "";
    const base = parseNumberES(hBase ? row[hBase] : "");
    const iva = parseNumberES(hIva ? row[hIva] : "");
    const total = parseNumberES(hTotal ? row[hTotal] : "");
    if (!contacto && !total) return;
    if (!contacto) {
      errores.push({ fila: i + 2, motivo: "Sin contacto/cliente" });
      return;
    }
    if (total <= 0 && base <= 0) {
      errores.push({ fila: i + 2, motivo: "Sin importes" });
      return;
    }
    facturas.push({
      numero: hNumero ? row[hNumero] : undefined,
      contacto_nombre: contacto,
      contacto_nif: hNif ? row[hNif] : undefined,
      fecha_emision: parseFechaES(hFecha ? row[hFecha] : undefined),
      fecha_vencimiento: parseFechaES(hVenc ? row[hVenc] : undefined),
      base: base || total / 1.21,
      iva: iva || total - (base || total / 1.21),
      total: total || base + iva,
      tipo,
    });
  });
  return { facturas, errores };
}

export function mapearGastos(csv: { headers: string[]; rows: FilaCSV[] }): { gastos: GastoImport[]; errores: { fila: number; motivo: string }[] } {
  const gastos: GastoImport[] = [];
  const errores: { fila: number; motivo: string }[] = [];

  const hContacto = findHeader(csv.headers, HEADERS_MAP.contacto_nombre);
  const hFecha = findHeader(csv.headers, HEADERS_MAP.fecha_emision);
  const hBase = findHeader(csv.headers, HEADERS_MAP.base);
  const hIva = findHeader(csv.headers, HEADERS_MAP.iva);
  const hTotal = findHeader(csv.headers, HEADERS_MAP.total);
  const hConcepto = findHeader(csv.headers, HEADERS_MAP.concepto);

  csv.rows.forEach((row, i) => {
    const proveedor = hContacto ? row[hContacto] : "";
    const total = parseNumberES(hTotal ? row[hTotal] : "");
    const base = parseNumberES(hBase ? row[hBase] : "");
    if (!proveedor) {
      errores.push({ fila: i + 2, motivo: "Sin proveedor" });
      return;
    }
    gastos.push({
      proveedor,
      concepto: hConcepto ? row[hConcepto] : undefined,
      fecha: parseFechaES(hFecha ? row[hFecha] : undefined),
      base: base || total / 1.21,
      iva: parseNumberES(hIva ? row[hIva] : "") || total - (base || total / 1.21),
      total: total || base * 1.21,
    });
  });
  return { gastos, errores };
}

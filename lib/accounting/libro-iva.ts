/**
 * Libro registro de IVA oficial (formato AEAT).
 *
 *   - Libro de IVA REPERCUTIDO: facturas emitidas.
 *   - Libro de IVA SOPORTADO: facturas recibidas + gastos con IVA.
 *
 * Estructura conforme a las claves de la AEAT (SII y Modelo 303 anexo):
 *   - Clave de operación: 01 régimen general, 02 exportación, 03 art. 21,
 *     04 régimen especial bienes usados, 05 régimen agencias viaje, 06 ISP,
 *     07 régimen especial caja, 08 IPSI/IGIC, 09 intracomunitaria, ...
 *   - Tipo de factura: F1 normal, F2 simplificada, R1-R5 rectificativas.
 */

export type LibroLinea = {
  fecha: string;
  numero: string;
  serie: string;
  contacto_nombre: string;
  contacto_nif: string;
  base: number;
  tipo_iva_pct: number;
  cuota_iva: number;
  total: number;
  irpf: number;
  clave_operacion: string;
  tipo_factura: string;
  // Para SII y conciliación
  factura_id?: string;
  gasto_id?: string;
};

export type LibroIVAResult = {
  lineas: LibroLinea[];
  resumen: {
    n_facturas: number;
    base_total: number;
    cuota_total: number;
    total: number;
    irpf_total: number;
    // Desglose por tipo IVA
    por_tipo: { tipo: number; base: number; cuota: number }[];
  };
};

type FacturaInput = {
  id: string;
  numero: string | null;
  fecha_emision: string | null;
  contacto_nombre: string | null;
  base: number;
  iva: number;
  total: number;
  metadata: Record<string, unknown>;
};

type GastoInput = {
  id: string;
  fecha: string | null;
  proveedor: string | null;
  concepto: string | null;
  base: number;
  iva: number;
  total: number;
  metadata: Record<string, unknown>;
};

function inferClaveOperacion(metadata: Record<string, unknown>, irpf: number): string {
  if (metadata.clave_operacion) return String(metadata.clave_operacion);
  if (metadata.es_intracomunitaria === true) return "09";
  if (metadata.es_exportacion === true) return "02";
  if (metadata.es_isp === true) return "06";
  if (irpf > 0) return "01"; // general con retención
  return "01";
}

function inferTipoFactura(metadata: Record<string, unknown>): string {
  if (metadata.tipo_factura) return String(metadata.tipo_factura);
  if (metadata.es_simplificada === true) return "F2";
  if (metadata.es_rectificativa === true) return "R1";
  return "F1";
}

function parseSerie(numero: string | null): { serie: string; numero: string } {
  if (!numero) return { serie: "", numero: "" };
  const m = /^([A-Z0-9]+?)-(\d+)$/i.exec(numero);
  if (m) return { serie: m[1], numero: m[2] };
  return { serie: "", numero };
}

function calcularTipoPct(base: number, cuota: number): number {
  if (base === 0) return 0;
  const pct = (cuota / base) * 100;
  // Redondeo a tipos típicos AEAT
  const tipos = [0, 4, 5, 10, 21];
  let mejor = tipos[0];
  let dist = Math.abs(pct - tipos[0]);
  for (const t of tipos) {
    const d = Math.abs(pct - t);
    if (d < dist) {
      dist = d;
      mejor = t;
    }
  }
  return mejor;
}

export function buildLibroRepercutido(facturas: FacturaInput[]): LibroIVAResult {
  const lineas: LibroLinea[] = [];
  const porTipo = new Map<number, { base: number; cuota: number }>();

  for (const f of facturas) {
    if (!f.fecha_emision) continue;
    const meta = f.metadata ?? {};
    const irpf = Number((meta.retencion as number | undefined) ?? 0);
    const base = Number(f.base ?? 0);
    const cuota = Number(f.iva ?? 0);
    const tipoPct = calcularTipoPct(base, cuota);
    const { serie, numero } = parseSerie(f.numero);

    lineas.push({
      fecha: f.fecha_emision,
      numero,
      serie,
      contacto_nombre: f.contacto_nombre ?? "",
      contacto_nif: String(meta.contacto_nif ?? meta.cliente_nif ?? ""),
      base,
      tipo_iva_pct: tipoPct,
      cuota_iva: cuota,
      total: Number(f.total ?? 0),
      irpf,
      clave_operacion: inferClaveOperacion(meta as Record<string, unknown>, irpf),
      tipo_factura: inferTipoFactura(meta as Record<string, unknown>),
      factura_id: f.id,
    });

    const prev = porTipo.get(tipoPct) ?? { base: 0, cuota: 0 };
    prev.base += base;
    prev.cuota += cuota;
    porTipo.set(tipoPct, prev);
  }

  return {
    lineas: lineas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero)),
    resumen: {
      n_facturas: lineas.length,
      base_total: round2(lineas.reduce((s, l) => s + l.base, 0)),
      cuota_total: round2(lineas.reduce((s, l) => s + l.cuota_iva, 0)),
      total: round2(lineas.reduce((s, l) => s + l.total, 0)),
      irpf_total: round2(lineas.reduce((s, l) => s + l.irpf, 0)),
      por_tipo: Array.from(porTipo.entries())
        .map(([tipo, v]) => ({ tipo, base: round2(v.base), cuota: round2(v.cuota) }))
        .sort((a, b) => a.tipo - b.tipo),
    },
  };
}

export function buildLibroSoportado(facturas: FacturaInput[], gastos: GastoInput[]): LibroIVAResult {
  const lineas: LibroLinea[] = [];
  const porTipo = new Map<number, { base: number; cuota: number }>();

  for (const f of facturas) {
    if (!f.fecha_emision) continue;
    const meta = f.metadata ?? {};
    const irpf = Number((meta.retencion_irpf as number | undefined) ?? 0);
    const base = Number(f.base ?? 0);
    const cuota = Number(f.iva ?? 0);
    const tipoPct = calcularTipoPct(base, cuota);
    const { serie, numero } = parseSerie(f.numero);
    lineas.push({
      fecha: f.fecha_emision,
      numero,
      serie,
      contacto_nombre: f.contacto_nombre ?? "",
      contacto_nif: String(meta.contacto_nif ?? meta.proveedor_nif ?? ""),
      base,
      tipo_iva_pct: tipoPct,
      cuota_iva: cuota,
      total: Number(f.total ?? 0),
      irpf,
      clave_operacion: inferClaveOperacion(meta as Record<string, unknown>, irpf),
      tipo_factura: inferTipoFactura(meta as Record<string, unknown>),
      factura_id: f.id,
    });
    const prev = porTipo.get(tipoPct) ?? { base: 0, cuota: 0 };
    prev.base += base;
    prev.cuota += cuota;
    porTipo.set(tipoPct, prev);
  }

  for (const g of gastos) {
    if (!g.fecha) continue;
    const meta = g.metadata ?? {};
    const base = Number(g.base ?? 0);
    const cuota = Number(g.iva ?? 0);
    const tipoPct = calcularTipoPct(base, cuota);
    lineas.push({
      fecha: g.fecha,
      numero: g.id.slice(0, 8),
      serie: "G",
      contacto_nombre: g.proveedor ?? g.concepto ?? "",
      contacto_nif: String(meta.proveedor_nif ?? ""),
      base,
      tipo_iva_pct: tipoPct,
      cuota_iva: cuota,
      total: Number(g.total ?? 0),
      irpf: Number((meta.retencion_irpf as number | undefined) ?? 0),
      clave_operacion: "01",
      tipo_factura: "F2",
      gasto_id: g.id,
    });
    const prev = porTipo.get(tipoPct) ?? { base: 0, cuota: 0 };
    prev.base += base;
    prev.cuota += cuota;
    porTipo.set(tipoPct, prev);
  }

  return {
    lineas: lineas.sort((a, b) => a.fecha.localeCompare(b.fecha)),
    resumen: {
      n_facturas: lineas.length,
      base_total: round2(lineas.reduce((s, l) => s + l.base, 0)),
      cuota_total: round2(lineas.reduce((s, l) => s + l.cuota_iva, 0)),
      total: round2(lineas.reduce((s, l) => s + l.total, 0)),
      irpf_total: round2(lineas.reduce((s, l) => s + l.irpf, 0)),
      por_tipo: Array.from(porTipo.entries())
        .map(([tipo, v]) => ({ tipo, base: round2(v.base), cuota: round2(v.cuota) }))
        .sort((a, b) => a.tipo - b.tipo),
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Exporta el libro como CSV con separador punto y coma (compatible AEAT/Excel ES).
 */
export function libroToCSV(libro: LibroIVAResult, titulo: string): string {
  const sep = ";";
  const headers = [
    "Fecha", "Serie", "Número", "Tipo factura", "Clave operación",
    "NIF tercero", "Nombre tercero",
    "Base", "Tipo IVA %", "Cuota IVA", "IRPF retenido", "Total",
  ];
  const rows = libro.lineas.map((l) => [
    l.fecha,
    l.serie,
    l.numero,
    l.tipo_factura,
    l.clave_operacion,
    l.contacto_nif,
    `"${l.contacto_nombre.replace(/"/g, '""')}"`,
    l.base.toFixed(2).replace(".", ","),
    l.tipo_iva_pct.toFixed(0),
    l.cuota_iva.toFixed(2).replace(".", ","),
    l.irpf.toFixed(2).replace(".", ","),
    l.total.toFixed(2).replace(".", ","),
  ].join(sep));

  const totales = [
    "TOTAL", "", "", "", "", "", "",
    libro.resumen.base_total.toFixed(2).replace(".", ","),
    "",
    libro.resumen.cuota_total.toFixed(2).replace(".", ","),
    libro.resumen.irpf_total.toFixed(2).replace(".", ","),
    libro.resumen.total.toFixed(2).replace(".", ","),
  ].join(sep);

  return `${titulo}\n\n${headers.join(sep)}\n${rows.join("\n")}\n${totales}\n`;
}

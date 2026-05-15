/**
 * Modelo 349 — Declaración recapitulativa de operaciones intracomunitarias.
 * Periodo: mensual (gran empresa) o trimestral (régimen general).
 *
 * Claves de operación:
 *   E — Entregas intracomunitarias de bienes
 *   A — Adquisiciones intracomunitarias de bienes
 *   T — Operaciones triangulares
 *   S — Prestación intracomunitaria de servicios
 *   I — Adquisición intracomunitaria de servicios
 *   M — Sin establecimiento permanente (rectificación)
 */

export type FacturaInput = {
  id: string;
  tipo: "emitida" | "recibida" | "simplificada";
  contacto_nombre: string | null;
  contacto_nif?: string | null;
  base: number;
  fecha_emision: string | null;
  metadata?: Record<string, unknown> | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export type OperacionIntracom = {
  contacto_nombre: string;
  vat_id?: string;
  clave: "E" | "A" | "T" | "S" | "I" | "M";
  base: number;
  num_operaciones: number;
};

export type Casillas349 = {
  num_operadores: number;
  total_entregas: number;       // claves E + T
  total_adquisiciones: number;  // clave A
  total_servicios_prestados: number;  // clave S
  total_servicios_recibidos: number;  // clave I
  total: number;
};

function claveOf(f: FacturaInput): "E" | "A" | "T" | "S" | "I" | null {
  const m = (f.metadata ?? {}) as Record<string, unknown>;
  if (!m.intracomunitaria) return null;
  const esServicio = Boolean(m.es_servicio);
  const esTriangular = Boolean(m.triangular);
  if (f.tipo === "emitida" || f.tipo === "simplificada") {
    if (esTriangular) return "T";
    if (esServicio) return "S";
    return "E";
  }
  if (f.tipo === "recibida") {
    if (esServicio) return "I";
    return "A";
  }
  return null;
}

export function calcular349(input: { facturas: FacturaInput[] }): {
  casillas: Casillas349;
  operaciones: OperacionIntracom[];
  warnings: string[];
} {
  const map = new Map<string, OperacionIntracom>();
  const warnings: string[] = [];

  for (const f of input.facturas) {
    const clave = claveOf(f);
    if (!clave) continue;
    if (!f.contacto_nombre) {
      warnings.push(`Factura ${f.id}: operación intracomunitaria sin contacto identificado.`);
      continue;
    }
    const meta = (f.metadata ?? {}) as Record<string, unknown>;
    const vatId = (meta.vat_id as string | undefined) ?? f.contacto_nif ?? undefined;
    const key = `${clave}|${(vatId ?? f.contacto_nombre).toLowerCase()}`;
    const prev = map.get(key) ?? {
      contacto_nombre: f.contacto_nombre,
      vat_id: vatId,
      clave,
      base: 0,
      num_operaciones: 0,
    };
    prev.base += Number(f.base ?? 0);
    prev.num_operaciones += 1;
    map.set(key, prev);
  }

  const ops = Array.from(map.values()).map((o) => ({ ...o, base: round2(o.base) }));

  const c: Casillas349 = {
    num_operadores: ops.length,
    total_entregas: round2(ops.filter((o) => o.clave === "E" || o.clave === "T").reduce((s, o) => s + o.base, 0)),
    total_adquisiciones: round2(ops.filter((o) => o.clave === "A").reduce((s, o) => s + o.base, 0)),
    total_servicios_prestados: round2(ops.filter((o) => o.clave === "S").reduce((s, o) => s + o.base, 0)),
    total_servicios_recibidos: round2(ops.filter((o) => o.clave === "I").reduce((s, o) => s + o.base, 0)),
    total: round2(ops.reduce((s, o) => s + o.base, 0)),
  };

  if (ops.some((o) => !o.vat_id)) {
    warnings.push("Algunos operadores no tienen VAT ID intracomunitario. Es obligatorio para presentar el 349.");
  }

  return { casillas: c, operaciones: ops.sort((a, b) => b.base - a.base), warnings };
}

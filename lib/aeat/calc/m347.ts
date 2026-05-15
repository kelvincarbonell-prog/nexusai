/**
 * Modelo 347 — Declaración anual de operaciones con terceras personas.
 * Anual, presentado en febrero. Obligatorio cuando un mismo tercero supera
 * 3.005,06 € en el año (suma de operaciones emitidas o recibidas).
 *
 * Excluye:
 * - Operaciones ya incluidas en SII
 * - Adquisiciones / entregas intracomunitarias (van al 349)
 * - Arrendamientos sujetos a retención (van al 180)
 * - Operaciones a no establecidos
 */

export type FacturaInput = {
  id: string;
  tipo: "emitida" | "recibida" | "simplificada";
  contacto_nombre: string | null;
  contacto_nif?: string | null;
  base: number;
  iva: number;
  fecha_emision: string | null;
  metadata?: Record<string, unknown> | null;
};

const UMBRAL_ANUAL = 3005.06;
const round2 = (n: number) => Math.round(n * 100) / 100;

function trimestreOf(fecha: string | null): "T1" | "T2" | "T3" | "T4" | null {
  if (!fecha) return null;
  const m = Number(fecha.slice(5, 7));
  if (m <= 3) return "T1";
  if (m <= 6) return "T2";
  if (m <= 9) return "T3";
  if (m <= 12) return "T4";
  return null;
}

export type OperadorAgregado = {
  contacto_nombre: string;
  contacto_nif?: string;
  tipo: "cliente" | "proveedor";
  importe_anual: number;
  t1: number;
  t2: number;
  t3: number;
  t4: number;
  num_operaciones: number;
};

export type Casillas347 = {
  c01: number;     // num declarados (clientes)
  c02: number;     // num declarados (proveedores)
  c03: number;     // importe total clientes
  c04: number;     // importe total proveedores
  c05: number;     // total operadores declarados
};

export function calcular347(input: { facturas: FacturaInput[] }): {
  casillas: Casillas347;
  operadores: OperadorAgregado[];
  warnings: string[];
} {
  const map = new Map<string, OperadorAgregado>();

  for (const f of input.facturas) {
    if (!f.contacto_nombre) continue;
    // Excluir intracomunitarias y arrendamientos sujetos a retención
    const meta = (f.metadata ?? {}) as Record<string, unknown>;
    if (meta.intracomunitaria || meta.exento_347) continue;
    if (meta.es_alquiler && meta.retencion_pct) continue;

    const tipo: "cliente" | "proveedor" = f.tipo === "recibida" ? "proveedor" : "cliente";
    const importe = Number(f.base ?? 0) + Number(f.iva ?? 0);
    const key = `${tipo}|${(f.contacto_nif || f.contacto_nombre || "").trim().toLowerCase()}`;
    const prev = map.get(key) ?? {
      contacto_nombre: f.contacto_nombre,
      contacto_nif: f.contacto_nif ?? undefined,
      tipo,
      importe_anual: 0,
      t1: 0,
      t2: 0,
      t3: 0,
      t4: 0,
      num_operaciones: 0,
    };
    prev.importe_anual += importe;
    prev.num_operaciones += 1;
    const t = trimestreOf(f.fecha_emision);
    if (t === "T1") prev.t1 += importe;
    else if (t === "T2") prev.t2 += importe;
    else if (t === "T3") prev.t3 += importe;
    else if (t === "T4") prev.t4 += importe;
    map.set(key, prev);
  }

  const todos = Array.from(map.values()).map((o) => ({
    ...o,
    importe_anual: round2(o.importe_anual),
    t1: round2(o.t1),
    t2: round2(o.t2),
    t3: round2(o.t3),
    t4: round2(o.t4),
  }));

  // Sólo operadores que superan el umbral
  const declarables = todos.filter((o) => o.importe_anual >= UMBRAL_ANUAL);

  const clientes = declarables.filter((o) => o.tipo === "cliente");
  const proveedores = declarables.filter((o) => o.tipo === "proveedor");

  const c: Casillas347 = {
    c01: clientes.length,
    c02: proveedores.length,
    c03: round2(clientes.reduce((s, o) => s + o.importe_anual, 0)),
    c04: round2(proveedores.reduce((s, o) => s + o.importe_anual, 0)),
    c05: declarables.length,
  };

  const warnings: string[] = [];
  if (declarables.some((o) => !o.contacto_nif)) {
    warnings.push("Algunos operadores no tienen NIF guardado. Es obligatorio antes de presentar.");
  }
  if (todos.length > declarables.length) {
    warnings.push(`${todos.length - declarables.length} terceros NO declarables (no superan los 3.005,06 € en el año).`);
  }

  return { casillas: c, operadores: declarables.sort((a, b) => b.importe_anual - a.importe_anual), warnings };
}

/**
 * Modelo 232 — Declaración informativa de operaciones vinculadas y de operaciones
 * y situaciones relacionadas con países o territorios calificados como paraísos
 * fiscales. Anual, presentación: noviembre.
 *
 * Obligatorio cuando:
 *  - Conjunto de operaciones del mismo tipo y método de valoración > 250.000 € anual
 *  - Operaciones específicas > 100.000 € anual con la misma persona/entidad
 *  - Cualquier operación con paraísos fiscales
 */

export type OperacionVinculadaInput = {
  id: string;
  tipo: "emitida" | "recibida" | "simplificada";
  contacto_nombre: string | null;
  base: number;
  fecha_emision: string | null;
  metadata?: Record<string, unknown> | null;
};

const UMBRAL_GENERAL = 250_000;
const UMBRAL_ESPECIFICO = 100_000;
const round2 = (n: number) => Math.round(n * 100) / 100;

export type OperadorVinculado = {
  contacto_nombre: string;
  nif?: string;
  tipo_relacion?: string;     // 'socio', 'administrador', 'grupo', 'otra'
  metodo_valoracion?: string;  // 'precio_libre', 'coste_incrementado', 'precio_reventa', 'beneficio', 'distribucion'
  importe_anual: number;
  num_operaciones: number;
  es_paraiso: boolean;
};

export type Casillas232 = {
  total_vinculados: number;
  total_paraisos: number;
  importe_vinculados: number;
  importe_paraisos: number;
};

export function calcular232(input: { facturas: OperacionVinculadaInput[] }): {
  casillas: Casillas232;
  operadores: OperadorVinculado[];
  warnings: string[];
} {
  const map = new Map<string, OperadorVinculado>();
  const warnings: string[] = [];

  for (const f of input.facturas) {
    const meta = (f.metadata ?? {}) as Record<string, unknown>;
    const vinculada = Boolean(meta.es_vinculada);
    const paraiso = Boolean(meta.paraiso_fiscal);
    if (!vinculada && !paraiso) continue;
    if (!f.contacto_nombre) {
      warnings.push(`Factura ${f.id}: vinculada/paraíso sin contacto.`);
      continue;
    }
    const key = (f.contacto_nombre || "").toLowerCase();
    const prev = map.get(key) ?? {
      contacto_nombre: f.contacto_nombre,
      nif: meta.contacto_nif as string | undefined,
      tipo_relacion: meta.tipo_relacion as string | undefined,
      metodo_valoracion: meta.metodo_valoracion as string | undefined,
      importe_anual: 0,
      num_operaciones: 0,
      es_paraiso: paraiso,
    };
    prev.importe_anual += Number(f.base ?? 0);
    prev.num_operaciones += 1;
    if (paraiso) prev.es_paraiso = true;
    map.set(key, prev);
  }

  const operadores = Array.from(map.values()).map((o) => ({ ...o, importe_anual: round2(o.importe_anual) }));

  const declarables = operadores.filter((o) => o.es_paraiso || o.importe_anual >= UMBRAL_GENERAL || o.importe_anual >= UMBRAL_ESPECIFICO);
  const paraisos = declarables.filter((o) => o.es_paraiso);

  const c: Casillas232 = {
    total_vinculados: declarables.length,
    total_paraisos: paraisos.length,
    importe_vinculados: round2(declarables.reduce((s, o) => s + o.importe_anual, 0)),
    importe_paraisos: round2(paraisos.reduce((s, o) => s + o.importe_anual, 0)),
  };

  if (operadores.length > declarables.length) {
    warnings.push(`${operadores.length - declarables.length} operaciones marcadas como vinculadas pero NO superan los umbrales (250.000 € general / 100.000 € específico).`);
  }

  return { casillas: c, operadores: declarables.sort((a, b) => b.importe_anual - a.importe_anual), warnings };
}

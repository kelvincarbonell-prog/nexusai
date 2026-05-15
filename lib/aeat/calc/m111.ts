/**
 * Modelo 111 — Retenciones e ingresos a cuenta. IRPF trimestral.
 *
 * MVP: rendimientos del trabajo (claves A/B) y rendimientos de actividades
 * económicas (claves G/H, profesionales). No incluye claves de capital
 * mobiliario, ganancias patrimoniales, premios ni cesión de imagen.
 */

export type NominaInput = {
  id: string;
  trabajador_id: string | null;
  periodo: string; // YYYY-MM
  total: number;   // bruto
  metadata?: {
    base_irpf?: number;
    irpf_retenido?: number;
  } | null;
};

export type FacturaProfesionalInput = {
  id: string;
  base: number;
  irpf?: number;
  irpf_pct?: number;
  fecha_emision: string | null;
  metadata?: Record<string, unknown> | null;
};

export type Casillas111 = {
  // Trabajo personal (clave A)
  c01: number; c02: number; c03: number; // num perceptores / base / retenciones
  // Profesionales (clave G)
  c04: number; c05: number; c06: number;
  // Total
  c28: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function hasIrpf(meta: Record<string, unknown> | null | undefined): boolean {
  if (!meta) return false;
  return Boolean(meta["retencion_irpf"]) || Boolean(meta["irpf_pct"]) || Boolean(meta["es_profesional"]);
}

export function calcular111(input: {
  nominas: NominaInput[];
  facturasProfesionales: FacturaProfesionalInput[];
}): { casillas: Casillas111; warnings: string[]; resumen: { trabajadores: number; profesionales: number } } {
  const c: Casillas111 = { c01: 0, c02: 0, c03: 0, c04: 0, c05: 0, c06: 0, c28: 0 };
  const warnings: string[] = [];

  const trabajadoresSet = new Set<string>();
  for (const n of input.nominas) {
    if (n.trabajador_id) trabajadoresSet.add(n.trabajador_id);
    const base = Number(n.metadata?.base_irpf ?? n.total ?? 0);
    const retenido = Number(n.metadata?.irpf_retenido ?? 0);
    c.c02 += base;
    c.c03 += retenido;
    if (!n.metadata?.base_irpf) {
      warnings.push(`Nómina ${n.id}: falta base_irpf en metadata; usando el total bruto como aproximación.`);
    }
  }
  c.c01 = trabajadoresSet.size;

  const profSet = new Set<string>();
  for (const f of input.facturasProfesionales) {
    if (!hasIrpf(f.metadata) && !f.irpf) continue;
    profSet.add(f.id);
    const base = Number(f.base ?? 0);
    const retenido = Number(f.irpf ?? base * Number(f.irpf_pct ?? f.metadata?.["retencion_pct"] ?? 0) / 100);
    c.c05 += base;
    c.c06 += retenido;
  }
  c.c04 = profSet.size;

  c.c28 = round2(c.c03 + c.c06);
  for (const k of Object.keys(c) as (keyof Casillas111)[]) c[k] = round2(c[k] as number);

  return {
    casillas: c,
    warnings,
    resumen: { trabajadores: c.c01, profesionales: c.c04 },
  };
}

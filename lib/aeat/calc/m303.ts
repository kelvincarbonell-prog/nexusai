/**
 * Cálculo del Modelo 303 (IVA trimestral, autoliquidación).
 * Régimen general. Excluye prorrata, recargo de equivalencia y criterio de caja
 * (warnings los anotan en validators.ts para que el usuario lo revise manual).
 *
 * Entrada: facturas (emitidas/recibidas/simplificadas) y gastos del periodo.
 * Salida: objeto Casillas303 con las celdas oficiales rellenadas y resultado.
 */

export type FacturaInput = {
  id: string;
  tipo: "emitida" | "recibida" | "simplificada";
  base: number;
  iva: number;
  iva_pct?: number;
  irpf?: number;
  irpf_pct?: number;
  fecha_emision: string | null;
  metadata?: Record<string, unknown> | null;
};

export type GastoInput = {
  id: string;
  base: number;
  iva: number;
  iva_pct?: number;
  fecha: string | null;
  metadata?: Record<string, unknown> | null;
};

export type Casillas303 = {
  // Régimen general - IVA devengado
  c01: number; c02: number; c03: number;     // base 4% / cuota 4% (recargo no usado)
  c04: number; c05: number; c06: number;     // base 10% / cuota 10%
  c07: number; c08: number; c09: number;     // base 21% / cuota 21%

  // Adquisiciones intracomunitarias
  c10: number; c11: number;

  // Inversión sujeto pasivo
  c12: number; c13: number;

  // Modificación bases
  c14: number; c15: number;

  // Total devengado
  c27: number;

  // IVA deducible
  c28: number; c29: number;     // soportado op. interiores corrientes (base/cuota)
  c30: number; c31: number;     // soportado op. interiores bienes inversión
  c32: number; c33: number;     // soportado importaciones bienes corrientes
  c34: number; c35: number;     // soportado importaciones bienes inversión
  c36: number; c37: number;     // soportado adquisiciones intracomunitarias bienes corrientes
  c38: number; c39: number;     // soportado adquisiciones intracomunitarias bienes inversión

  // Rectificaciones / regularizaciones
  c40: number; c41: number;     // rectificación deducciones

  // Total a deducir
  c45: number;

  // Diferencia
  c46: number;

  // Atribuible a la Administración del Estado
  c66: number;

  // A compensar / a devolver / a ingresar
  c69: number;     // cuotas a compensar de periodos anteriores
  c70: number;     // regularización anual prorrata
  c71: number;     // resultado liquidación
};

const ZEROS = (): Casillas303 => ({
  c01: 0, c02: 0, c03: 0, c04: 0, c05: 0, c06: 0, c07: 0, c08: 0, c09: 0,
  c10: 0, c11: 0, c12: 0, c13: 0, c14: 0, c15: 0, c27: 0,
  c28: 0, c29: 0, c30: 0, c31: 0, c32: 0, c33: 0, c34: 0, c35: 0,
  c36: 0, c37: 0, c38: 0, c39: 0, c40: 0, c41: 0, c45: 0, c46: 0,
  c66: 0, c69: 0, c70: 0, c71: 0,
});

const round2 = (n: number) => Math.round(n * 100) / 100;

function metaFlag(meta: Record<string, unknown> | null | undefined, key: string): boolean {
  if (!meta) return false;
  const v = meta[key];
  return v === true || v === "true" || v === 1 || v === "1";
}

function metaIvaTipo(meta: Record<string, unknown> | null | undefined): number | null {
  if (!meta) return null;
  const raw = meta["iva_tipo"];
  if (typeof raw === "number") return raw;
  if (typeof raw === "string" && raw) return Number(raw);
  return null;
}

function tipoFromPct(pct: number | null | undefined): 4 | 10 | 21 | null {
  if (pct == null) return null;
  if (pct <= 5) return 4;
  if (pct <= 12) return 10;
  if (pct <= 22) return 21;
  return null;
}

export function calcular303(input: { facturas: FacturaInput[]; gastos: GastoInput[] }): {
  casillas: Casillas303;
  warnings: string[];
  resumen: { num_emitidas: number; num_recibidas: number; num_gastos: number };
} {
  const c = ZEROS();
  const warnings: string[] = [];

  // ====== IVA devengado (facturas emitidas) ======
  let countEmit = 0;
  for (const f of input.facturas.filter((f) => f.tipo === "emitida" || f.tipo === "simplificada")) {
    countEmit++;
    const tipo = tipoFromPct(f.iva_pct ?? metaIvaTipo(f.metadata) ?? derivePctFromBaseIva(f.base, f.iva));
    const base = Number(f.base ?? 0);
    const cuota = Number(f.iva ?? 0);

    if (metaFlag(f.metadata, "isp")) {
      c.c12 += base;
      c.c13 += cuota;
      continue;
    }
    if (metaFlag(f.metadata, "intracomunitaria")) {
      c.c10 += base;
      c.c11 += cuota;
      continue;
    }

    if (tipo === 4) { c.c01 += base; c.c03 += cuota; }
    else if (tipo === 10) { c.c04 += base; c.c06 += cuota; }
    else if (tipo === 21) { c.c07 += base; c.c09 += cuota; }
    else {
      warnings.push(`Factura emitida ${f.id} sin tipo de IVA reconocible (base ${base} / cuota ${cuota}).`);
      c.c07 += base; c.c09 += cuota;
    }
  }

  // ====== IVA soportado (facturas recibidas + gastos) ======
  let countRec = 0;
  for (const f of input.facturas.filter((f) => f.tipo === "recibida")) {
    countRec++;
    const base = Number(f.base ?? 0);
    const cuota = Number(f.iva ?? 0);

    if (metaFlag(f.metadata, "intracomunitaria")) {
      if (metaFlag(f.metadata, "es_inversion")) { c.c38 += base; c.c39 += cuota; }
      else { c.c36 += base; c.c37 += cuota; }
      continue;
    }
    if (metaFlag(f.metadata, "importacion")) {
      if (metaFlag(f.metadata, "es_inversion")) { c.c34 += base; c.c35 += cuota; }
      else { c.c32 += base; c.c33 += cuota; }
      continue;
    }
    if (metaFlag(f.metadata, "es_inversion")) {
      c.c30 += base; c.c31 += cuota;
    } else {
      c.c28 += base; c.c29 += cuota;
    }
  }

  let countGastos = 0;
  for (const g of input.gastos) {
    countGastos++;
    const base = Number(g.base ?? 0);
    const cuota = Number(g.iva ?? 0);
    if (cuota === 0) continue;
    if (metaFlag(g.metadata, "intracomunitaria")) {
      if (metaFlag(g.metadata, "es_inversion")) { c.c38 += base; c.c39 += cuota; }
      else { c.c36 += base; c.c37 += cuota; }
      continue;
    }
    if (metaFlag(g.metadata, "importacion")) {
      if (metaFlag(g.metadata, "es_inversion")) { c.c34 += base; c.c35 += cuota; }
      else { c.c32 += base; c.c33 += cuota; }
      continue;
    }
    if (metaFlag(g.metadata, "es_inversion")) {
      c.c30 += base; c.c31 += cuota;
    } else {
      c.c28 += base; c.c29 += cuota;
    }
  }

  // ====== Totales ======
  c.c27 = round2(
    c.c03 + c.c06 + c.c09 + c.c11 + c.c13 + c.c15,
  );
  c.c45 = round2(
    c.c29 + c.c31 + c.c33 + c.c35 + c.c37 + c.c39 + c.c41,
  );
  c.c46 = round2(c.c27 - c.c45);
  c.c66 = c.c46;       // 100 % Administración del Estado (sin tributación foral)
  c.c71 = round2(c.c66 - c.c69 + c.c70);

  // Redondeo final por casilla
  for (const k of Object.keys(c) as (keyof Casillas303)[]) {
    c[k] = round2(c[k]);
  }

  if (c.c71 < 0) {
    warnings.push("Resultado negativo: se puede solicitar a compensar o a devolver (último trimestre del año).");
  }

  return {
    casillas: c,
    warnings,
    resumen: { num_emitidas: countEmit, num_recibidas: countRec, num_gastos: countGastos },
  };
}

function derivePctFromBaseIva(base: number, iva: number): number | null {
  if (!base || base === 0) return null;
  const pct = (iva / base) * 100;
  return Number.isFinite(pct) ? pct : null;
}

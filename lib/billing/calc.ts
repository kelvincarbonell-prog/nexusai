/**
 * Cálculo de totales para presupuestos, facturas y recurrentes.
 * Aplica descuento por línea, IVA y retención IRPF.
 */

export type Linea = {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento_pct?: number;
  iva_pct?: number;
  irpf_pct?: number;
};

export type LineaCalculada = Linea & {
  base: number;
  iva: number;
  irpf: number;
  total: number;
};

export type TotalesDoc = {
  base_imponible: number;
  cuota_iva: number;
  retencion_irpf: number;
  total: number;
  lineas: LineaCalculada[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcularLineas(lineas: Linea[]): TotalesDoc {
  const out: LineaCalculada[] = [];
  let base = 0, iva = 0, irpf = 0;

  for (const l of lineas) {
    const cantidad = Number(l.cantidad ?? 0);
    const precio = Number(l.precio_unitario ?? 0);
    const desc = Number(l.descuento_pct ?? 0) / 100;
    const ivaPct = Number(l.iva_pct ?? 21) / 100;
    const irpfPct = Number(l.irpf_pct ?? 0) / 100;

    const baseLinea = cantidad * precio * (1 - desc);
    const ivaLinea = baseLinea * ivaPct;
    const irpfLinea = baseLinea * irpfPct;
    const totalLinea = baseLinea + ivaLinea - irpfLinea;

    out.push({
      ...l,
      base: round2(baseLinea),
      iva: round2(ivaLinea),
      irpf: round2(irpfLinea),
      total: round2(totalLinea),
    });
    base += baseLinea;
    iva += ivaLinea;
    irpf += irpfLinea;
  }

  return {
    base_imponible: round2(base),
    cuota_iva: round2(iva),
    retencion_irpf: round2(irpf),
    total: round2(base + iva - irpf),
    lineas: out,
  };
}

export function siguienteEmision(
  desde: Date,
  frecuencia: "mensual" | "bimestral" | "trimestral" | "semestral" | "anual",
  diaEmision: number,
): Date {
  const months: Record<typeof frecuencia, number> = {
    mensual: 1,
    bimestral: 2,
    trimestral: 3,
    semestral: 6,
    anual: 12,
  };
  const result = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + months[frecuencia], diaEmision));
  return result;
}

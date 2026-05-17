/**
 * Cálculo de embargos salariales según Ley de Enjuiciamiento Civil (art. 607)
 * con tramos sobre el SMI.
 *
 * SMI 2026 (orientativo): 1.184 €/mes en 14 pagas → 16.576 €/año, 1.323€/mes
 * en proporción mensual a 12.
 *
 * Tramos LEC sobre el exceso del SMI mensual:
 *   1ª cuantía adicional (SMI a 2·SMI): 30 %
 *   2ª (2-3·SMI): 50 %
 *   3ª (3-4·SMI): 60 %
 *   4ª (4-5·SMI): 75 %
 *   5ª (>5·SMI): 90 %
 *
 * Sobre lo inembargable (≤ SMI) NO se embarga, salvo deuda por alimentos.
 */

export type EmbargoInput = {
  liquido_mensual: number;        // líquido nómina (antes de embargo)
  smi_mensual?: number;           // override
  pension_alimentos?: boolean;    // si true, todo el bruto es embargable
  porcentaje_pension?: number;    // % fijado por juzgado (0..100), si pension_alimentos
};

export type EmbargoResult = {
  inembargable: number;
  embargable_legal: number;
  tramos: Array<{ desde: number; hasta: number | null; pct: number; importe: number }>;
};

const SMI_2026 = 1323.0; // proporcional mensual a 12 pagas

export function calcularEmbargoLegal(input: EmbargoInput): EmbargoResult {
  const smi = input.smi_mensual ?? SMI_2026;
  const liquido = Math.max(0, input.liquido_mensual);

  // Caso pensión de alimentos: el juez fija; todo el bruto es embargable.
  if (input.pension_alimentos) {
    const pct = Math.max(0, Math.min(100, input.porcentaje_pension ?? 0));
    return {
      inembargable: 0,
      embargable_legal: Math.round(liquido * (pct / 100) * 100) / 100,
      tramos: [{ desde: 0, hasta: null, pct, importe: Math.round(liquido * (pct / 100) * 100) / 100 }],
    };
  }

  if (liquido <= smi) {
    return { inembargable: liquido, embargable_legal: 0, tramos: [] };
  }

  const tramos: Array<{ desde: number; hasta: number | null; pct: number; importe: number }> = [];
  const bandas = [
    { lim: 2 * smi, pct: 30 },
    { lim: 3 * smi, pct: 50 },
    { lim: 4 * smi, pct: 60 },
    { lim: 5 * smi, pct: 75 },
    { lim: Number.POSITIVE_INFINITY, pct: 90 },
  ];

  let base = smi;
  let restante = liquido;
  for (const b of bandas) {
    if (restante <= base) break;
    const techo = Math.min(restante, b.lim);
    if (techo <= base) continue;
    const porcion = techo - base;
    const importe = Math.round(porcion * (b.pct / 100) * 100) / 100;
    tramos.push({
      desde: Math.round(base * 100) / 100,
      hasta: b.lim === Number.POSITIVE_INFINITY ? null : Math.round(b.lim * 100) / 100,
      pct: b.pct,
      importe,
    });
    base = b.lim;
    if (restante <= b.lim) break;
  }

  const totalEmbargable = tramos.reduce((s, t) => s + t.importe, 0);
  return {
    inembargable: Math.round(smi * 100) / 100,
    embargable_legal: Math.round(totalEmbargable * 100) / 100,
    tramos,
  };
}

/**
 * Modelo 184 — Declaración informativa de entidades en régimen de atribución
 * de rentas (Comunidades de Bienes, Sociedades Civiles, Herencias yacentes).
 * Anual, presentación: febrero del año siguiente.
 *
 * Cada socio/comunero declara su parte proporcional en su propio IRPF.
 * El 184 informa a la AEAT del reparto.
 */

export type ComuneroInput = {
  nombre: string;
  nif: string;
  porcentaje: number;          // 0-100
};

export type Modelo184Input = {
  ingresos_totales: number;
  gastos_totales: number;
  retenciones_soportadas?: number;
  comuneros: ComuneroInput[];
};

export type Casillas184 = {
  total_ingresos: number;
  total_gastos: number;
  rendimiento_neto: number;
  total_retenciones: number;
  num_comuneros: number;
  porcentaje_total: number;
};

export type ReparteComunero = ComuneroInput & {
  rendimiento_atribuido: number;
  retencion_atribuida: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcular184(input: Modelo184Input): {
  casillas: Casillas184;
  warnings: string[];
  reparto: ReparteComunero[];
} {
  const warnings: string[] = [];
  const ingresos = Number(input.ingresos_totales ?? 0);
  const gastos = Number(input.gastos_totales ?? 0);
  const retenciones = Number(input.retenciones_soportadas ?? 0);
  const rendimiento = ingresos - gastos;

  const totalPorcentaje = input.comuneros.reduce((s, c) => s + Number(c.porcentaje), 0);
  if (Math.abs(totalPorcentaje - 100) > 0.01) {
    warnings.push(`Los porcentajes de los comuneros suman ${totalPorcentaje.toFixed(2)} %, deben sumar 100 %.`);
  }
  if (input.comuneros.length < 2) {
    warnings.push("El régimen de atribución requiere al menos 2 comuneros.");
  }

  const reparto: ReparteComunero[] = input.comuneros.map((c) => ({
    ...c,
    rendimiento_atribuido: round2((rendimiento * Number(c.porcentaje)) / 100),
    retencion_atribuida: round2((retenciones * Number(c.porcentaje)) / 100),
  }));

  return {
    casillas: {
      total_ingresos: round2(ingresos),
      total_gastos: round2(gastos),
      rendimiento_neto: round2(rendimiento),
      total_retenciones: round2(retenciones),
      num_comuneros: input.comuneros.length,
      porcentaje_total: round2(totalPorcentaje),
    },
    warnings,
    reparto,
  };
}

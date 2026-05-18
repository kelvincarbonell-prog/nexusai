/**
 * Cálculo de atrasos retroactivos (firma de convenio fuera de plazo).
 *
 * Caso típico: convenio se firma en septiembre 2026 pero aplica desde enero.
 * Hay que abonar la diferencia entre lo cobrado y lo que correspondía cada
 * mes. A3NOM permite calcular esto por trabajador con un solo clic.
 *
 * Funcionalidad:
 *   - dada una lista de nóminas pagadas y el nuevo salario,
 *   - calcula diferencia mensual y total,
 *   - genera un "concepto especial" para añadir a la siguiente nómina.
 */

export type NominaPagada = {
  periodo: string;       // YYYY-MM
  bruto: number;         // bruto que se pagó
};

export type AtrasoLinea = {
  periodo: string;
  bruto_pagado: number;
  bruto_nuevo: number;
  diferencia: number;
};

export type AtrasoResult = {
  lineas: AtrasoLinea[];
  total_diferencia: number;
  /** Aviso si alguna diferencia es negativa (cobró de más). */
  warnings: string[];
};

export function calcularAtrasos(input: {
  nominas: NominaPagada[];
  nuevo_bruto_mensual: number;
}): AtrasoResult {
  const lineas: AtrasoLinea[] = [];
  const warnings: string[] = [];
  let total = 0;

  for (const n of input.nominas) {
    const diff = Math.round((input.nuevo_bruto_mensual - n.bruto) * 100) / 100;
    lineas.push({
      periodo: n.periodo,
      bruto_pagado: Math.round(n.bruto * 100) / 100,
      bruto_nuevo: Math.round(input.nuevo_bruto_mensual * 100) / 100,
      diferencia: diff,
    });
    total += diff;
    if (diff < 0) {
      warnings.push(`En ${n.periodo} se pagó MÁS (${Math.abs(diff).toFixed(2)} €). Decide si compensas o no.`);
    }
  }

  return {
    lineas,
    total_diferencia: Math.round(total * 100) / 100,
    warnings,
  };
}

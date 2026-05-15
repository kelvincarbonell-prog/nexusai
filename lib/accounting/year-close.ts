/**
 * Cierre y apertura del ejercicio contable según PGC.
 *
 * Cierre (31/12):
 *   1. Regularización: cuentas del grupo 6 (gastos) y grupo 7 (ingresos)
 *      se saldan contra 129 'Resultado del ejercicio'.
 *   2. Asiento de cierre: todas las cuentas con saldo se cargan/abonan
 *      contra una cuenta puente para dejar todo el grupo 1-5 a cero.
 *
 * Apertura (01/01 año siguiente):
 *   Asiento simétrico al de cierre — restablece los saldos del grupo 1-5.
 *
 * Salida: lista de líneas que se insertan en journal_entries + journal_lines.
 */

export type SaldoCuenta = {
  account_id: string;
  code: string;
  saldo: number;       // positivo = deudor, negativo = acreedor
};

export type LineaPropuesta = {
  account_id: string;
  code: string;
  description: string;
  debit: number;
  credit: number;
};

function groupOf(code: string): number {
  return Number(code.charAt(0));
}

export function calcularRegularizacion(saldos: SaldoCuenta[]): {
  lineas: LineaPropuesta[];
  resultado: number;
} {
  const lineas: LineaPropuesta[] = [];
  let resultado = 0;

  // Grupo 7 ingresos: saldo acreedor (-). Para saldar: cargo en grupo 7, abono en 129.
  // Grupo 6 gastos: saldo deudor (+). Para saldar: abono en grupo 6, cargo en 129.
  for (const s of saldos) {
    const g = groupOf(s.code);
    if (g !== 6 && g !== 7) continue;
    if (Math.abs(s.saldo) < 0.005) continue;

    if (g === 7) {
      const cargo = Math.abs(s.saldo);
      lineas.push({
        account_id: s.account_id,
        code: s.code,
        description: "Regularización ingresos",
        debit: cargo,
        credit: 0,
      });
      resultado += cargo;
    } else if (g === 6) {
      const abono = Math.abs(s.saldo);
      lineas.push({
        account_id: s.account_id,
        code: s.code,
        description: "Regularización gastos",
        debit: 0,
        credit: abono,
      });
      resultado -= abono;
    }
  }

  // Contrapartida en 129
  lineas.push({
    account_id: "PLACEHOLDER_129",
    code: "129",
    description: "Resultado del ejercicio",
    debit: resultado < 0 ? Math.abs(resultado) : 0,
    credit: resultado > 0 ? resultado : 0,
  });

  return { lineas, resultado };
}

export function calcularAsientoCierre(saldos: SaldoCuenta[]): LineaPropuesta[] {
  const lineas: LineaPropuesta[] = [];
  // Tras la regularización, los grupos 6 y 7 ya están a cero.
  // El asiento de cierre saldra el resto de cuentas (grupos 1-5) contra sí mismas.
  // Convencionalmente cada cuenta con saldo deudor se carga contra su saldo acreedor.
  // Para mantener simplicidad: invertimos saldos.
  for (const s of saldos) {
    const g = groupOf(s.code);
    if (g === 6 || g === 7) continue;
    if (Math.abs(s.saldo) < 0.005) continue;

    if (s.saldo > 0) {
      // saldo deudor → abono
      lineas.push({
        account_id: s.account_id,
        code: s.code,
        description: "Asiento de cierre",
        debit: 0,
        credit: s.saldo,
      });
    } else {
      lineas.push({
        account_id: s.account_id,
        code: s.code,
        description: "Asiento de cierre",
        debit: Math.abs(s.saldo),
        credit: 0,
      });
    }
  }
  return lineas;
}

export function calcularAsientoApertura(lineasCierre: LineaPropuesta[]): LineaPropuesta[] {
  // Invertimos exactamente el asiento de cierre.
  return lineasCierre.map((l) => ({
    ...l,
    description: "Asiento de apertura",
    debit: l.credit,
    credit: l.debit,
  }));
}
